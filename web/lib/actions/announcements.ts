"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  announcements,
  announcementRecipients,
  leagues,
  leaguePlayers,
  players,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import {
  isAdminLike,
  getMyCommissionerLeagueIds,
} from "@/lib/auth/perms";
import { requireManageView } from "@/lib/auth/view";
import {
  isInviteEmailConfigured,
  sendAnnouncementEmail,
} from "@/lib/email/invite-email";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const createSchema = z.object({
  scope: z.enum(["global", "league"]),
  leagueId: z.string().uuid().optional().or(z.literal("")),
  headline: z.string().trim().min(1, "Headline required.").max(160),
  body: z.string().trim().min(1, "Body required.").max(2000),
  ctaLabel: z.string().trim().max(40).optional().or(z.literal("")),
  ctaUrl: z.string().trim().max(500).optional().or(z.literal("")),
  /** Comma-separated list. 'inbox' is implicit; 'email' triggers
   *  Resend broadcast. Validated against known values below. */
  channels: z.string().optional(),
});

const readForm = (fd: FormData) => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
};

const nullable = (s?: string | null) => {
  const t = (s ?? "").trim();
  return t.length === 0 ? null : t;
};

/**
 * Compose a new announcement and fan it out to its audience.
 *
 * Authorization:
 *   - scope='global': admin only (anything else 403s)
 *   - scope='league': admin OR commissioner of that specific league
 *
 * Recipients are computed at send time (snapshot semantics) — players
 * who join the league after the send don't retroactively receive it.
 * That's the right call for "announcements" specifically; if we ever
 * want a "pinned message" model we'll need a separate primitive.
 */
export async function createAnnouncement(
  formData: FormData,
): Promise<
  ActionResult<{
    id: string;
    recipientCount: number;
    /** When the email channel is selected: how many recipients we
     *  attempted (had an email on file) and how many actually
     *  succeeded. null when email wasn't a selected channel. */
    emailAttempted: number | null;
    emailSent: number | null;
  }>
> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in to send announcements." };
  }
  await requireManageView();

  const parsed = createSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const isAdmin = isAdminLike(session);

  // CTA validation: both label + url, or neither.
  const ctaLabel = nullable(v.ctaLabel);
  const ctaUrl = nullable(v.ctaUrl);
  if ((ctaLabel && !ctaUrl) || (ctaUrl && !ctaLabel)) {
    return {
      ok: false,
      error: "CTA needs both a label and a URL — or leave both blank.",
    };
  }

  // Channels — 'inbox' is always included even if not passed (it's
  // the default behavior and doesn't need consent). 'email' is the
  // only other accepted value in v1; gated on Resend config.
  const requestedChannels = (v.channels ?? "inbox")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const channels = Array.from(
    new Set(["inbox", ...requestedChannels.filter((c) => c === "email")]),
  );
  if (channels.includes("email") && !isInviteEmailConfigured()) {
    return {
      ok: false,
      error:
        "Email isn't configured for this project — set RESEND_API_KEY and ADMIN_FROM_EMAIL in Vercel, or send via Inbox only.",
    };
  }

  let recipientPlayerIds: string[] = [];
  let leagueId: string | null = null;

  if (v.scope === "global") {
    if (!isAdmin) {
      return {
        ok: false,
        error: "Only admins can send platform-wide announcements.",
      };
    }
    const rows = await db.select({ id: players.id }).from(players);
    recipientPlayerIds = rows.map((r) => r.id);
  } else {
    // scope === "league"
    if (!v.leagueId) {
      return { ok: false, error: "Pick a league." };
    }
    leagueId = v.leagueId;

    if (!isAdmin) {
      const myLeagueIds = await getMyCommissionerLeagueIds(session);
      if (!myLeagueIds.includes(leagueId)) {
        return {
          ok: false,
          error: "You can only send to leagues you commission.",
        };
      }
    }

    const [league] = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);
    if (!league) return { ok: false, error: "League not found." };

    const memberRows = await db
      .select({ playerId: leaguePlayers.playerId })
      .from(leaguePlayers)
      .where(eq(leaguePlayers.leagueId, leagueId));
    recipientPlayerIds = memberRows.map((r) => r.playerId);
  }

  if (recipientPlayerIds.length === 0) {
    return {
      ok: false,
      error:
        v.scope === "global"
          ? "No players on the platform yet."
          : "This league has no members yet.",
    };
  }

  // Insert the announcement first, then fan out recipients in one batch.
  const [row] = await db
    .insert(announcements)
    .values({
      scope: v.scope,
      leagueId,
      authorId: session.playerId,
      headline: v.headline,
      body: v.body,
      ctaLabel,
      ctaUrl,
      channels,
    })
    .returning({ id: announcements.id });

  const announcementId = row.id;

  // Bulk insert recipient rows. ON CONFLICT DO NOTHING so we tolerate
  // any retry / concurrency edge.
  await db
    .insert(announcementRecipients)
    .values(
      recipientPlayerIds.map((playerId) => ({
        announcementId,
        playerId,
      })),
    )
    .onConflictDoNothing();

  // Email broadcast — best-effort. Save already succeeded; a Resend
  // failure on any individual address doesn't undo the inbox row.
  let emailAttempted: number | null = null;
  let emailSent: number | null = null;
  if (channels.includes("email")) {
    // Look up emails + names for everyone we're broadcasting to.
    const recipients = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        email: players.email,
      })
      .from(players)
      .where(inArray(players.id, recipientPlayerIds));

    const haveEmail = recipients.filter(
      (r): r is { id: string; firstName: string; email: string } =>
        !!r.email,
    );
    emailAttempted = haveEmail.length;

    // Resolve a sender display name + league name + absolute CTA url.
    const author = session.playerId
      ? await db
          .select({
            firstName: players.firstName,
            lastName: players.lastName,
          })
          .from(players)
          .where(eq(players.id, session.playerId))
          .limit(1)
          .then((r) =>
            r[0] ? `${r[0].firstName} ${r[0].lastName}`.trim() : null,
          )
      : null;

    let leagueName: string | null = null;
    if (leagueId) {
      const [lg] = await db
        .select({ name: leagues.name })
        .from(leagues)
        .where(eq(leagues.id, leagueId))
        .limit(1);
      leagueName = lg?.name ?? null;
    }

    let absoluteCtaUrl: string | null = null;
    if (ctaUrl) {
      if (/^https?:\/\//i.test(ctaUrl)) {
        absoluteCtaUrl = ctaUrl;
      } else {
        const h = await headers();
        const proto = h.get("x-forwarded-proto") ?? "https";
        const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
        absoluteCtaUrl = host
          ? `${proto}://${host}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`
          : ctaUrl;
      }
    }

    // Send sequentially to avoid hammering Resend's rate limit. For
    // big sends (>200 recipients) we'd want to push this onto a
    // background worker / queue; deferring that until we hit it.
    let sent = 0;
    for (const r of haveEmail) {
      try {
        const res = await sendAnnouncementEmail({
          to: r.email,
          firstName: r.firstName,
          scope: v.scope,
          leagueName,
          authorName: author,
          headline: v.headline,
          body: v.body,
          ctaLabel,
          ctaUrl: absoluteCtaUrl,
        });
        if (res.ok) sent++;
      } catch {
        // swallow — best-effort; inbox row already exists
      }
    }
    emailSent = sent;
  }

  revalidatePath("/admin/announcements");
  revalidatePath("/inbox");
  return {
    ok: true,
    data: {
      id: announcementId,
      recipientCount: recipientPlayerIds.length,
      emailAttempted,
      emailSent,
    },
  };
}

/**
 * Mark a single announcement read for the current viewer. No-op if
 * already read or if the viewer isn't a recipient.
 */
export async function markAnnouncementRead(
  announcementId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in." };
  }
  await db
    .update(announcementRecipients)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(announcementRecipients.announcementId, announcementId),
        eq(announcementRecipients.playerId, session.playerId),
      ),
    );
  revalidatePath("/inbox");
  return { ok: true, data: { id: announcementId } };
}

/** Mark everything in the viewer's inbox as read. Used by the inbox header. */
export async function markAllAnnouncementsRead(): Promise<
  ActionResult<{ count: number }>
> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in." };
  }
  // Drizzle returns no row count from update without a returning clause,
  // so do a count first to surface a meaningful result to the client.
  const before = await db
    .select({ id: announcementRecipients.announcementId })
    .from(announcementRecipients)
    .where(
      and(
        eq(announcementRecipients.playerId, session.playerId),
        sql`${announcementRecipients.readAt} IS NULL`,
      ),
    );
  if (before.length === 0) {
    return { ok: true, data: { count: 0 } };
  }
  await db
    .update(announcementRecipients)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(announcementRecipients.playerId, session.playerId),
        sql`${announcementRecipients.readAt} IS NULL`,
      ),
    );
  revalidatePath("/inbox");
  return { ok: true, data: { count: before.length } };
}
