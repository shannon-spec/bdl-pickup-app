"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  db,
  gameInvites,
  gameInviteEvents,
  gameInviteBatches,
  gameRoster,
  games,
  leagues,
  players,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { canManageGame } from "@/lib/auth/perms";
import {
  getEffectiveInviteSettings,
  getConfirmedCounts,
} from "@/lib/queries/game-invites";
import {
  sendInviteInitial,
  sendInviteReminder,
  sendSeatsFilledNotice,
  type InviteEmailContext,
} from "@/lib/email/invite-email";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const newToken = () => randomBytes(32).toString("base64url");

async function logEvent(
  inviteId: string,
  gameId: string,
  type: string,
  actorId: string | null,
  note: string | null = null,
) {
  await db.insert(gameInviteEvents).values({
    inviteId,
    gameId,
    type,
    actorId,
    note,
  });
}

async function gateGameManager(gameId: string) {
  const session = await readSession();
  if (!session) return { ok: false as const, error: "Sign in." };
  if (!(await canManageGame(session, gameId))) {
    return { ok: false as const, error: "Forbidden — you don't manage this game." };
  }
  return { ok: true as const, session };
}

async function getBaseUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

const fmtGameDate = (date: string | null, time: string | null) => {
  if (!date) return "TBD";
  const dt = new Date(date + "T00:00:00");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()];
  let out = `${wd} · ${mo} ${dt.getDate()}`;
  if (time) {
    const [h, m] = time.split(":");
    const hr = Number(h);
    out += ` · ${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  }
  return out;
};

const fmtRelative = (expiresAt: Date) => {
  const ms = expiresAt.getTime() - Date.now();
  if (ms < 0) return "expired";
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.round(min / 60);
  return `in ${hr}h`;
};

async function inviteEmailContext(
  invite: typeof gameInvites.$inferSelect,
): Promise<InviteEmailContext | null> {
  const [row] = await db
    .select({
      game: games,
      league: { name: leagues.name },
      player: {
        firstName: players.firstName,
        email: players.email,
      },
    })
    .from(gameInvites)
    .innerJoin(games, eq(games.id, gameInvites.gameId))
    .leftJoin(leagues, eq(leagues.id, games.leagueId))
    .innerJoin(players, eq(players.id, gameInvites.playerId))
    .where(eq(gameInvites.id, invite.id))
    .limit(1);
  if (!row?.player.email) return null;
  const base = await getBaseUrl();
  return {
    to: row.player.email,
    firstName: row.player.firstName,
    leagueName: row.league?.name ?? row.game.leagueName ?? "BDL game",
    gameDateLabel: fmtGameDate(row.game.gameDate, row.game.gameTime),
    venue: row.game.venue,
    claimUrl: `${base}/i/${invite.claimToken}`,
    expiresAtLabel: invite.expiresAt
      ? fmtRelative(invite.expiresAt)
      : "soon",
    teamAName: row.game.teamAName ?? "White",
    teamBName: row.game.teamBName ?? "Dark",
  };
}

/**
 * Create one or many invites in a batch. Body shape (form):
 *   gameId, mode, channels (csv), playerIds (csv), expiryMinutesOverride?
 * Players already on the roster or in an active invite state for
 * this game are silently skipped.
 */
export async function createInvites(
  formData: FormData,
): Promise<ActionResult<{ count: number; batchId: string }>> {
  const gameId = String(formData.get("gameId") ?? "");
  if (!gameId) return { ok: false, error: "Missing gameId." };
  const gate = await gateGameManager(gameId);
  if (!gate.ok) return gate;

  const mode = String(formData.get("mode") ?? "single") as
    | "single"
    | "group"
    | "fcfs"
    | "backfill";
  const channelsCsv = String(formData.get("channels") ?? "email");
  const channels = channelsCsv.split(",").map((s) => s.trim()).filter(Boolean);
  if (channels.length === 0) channels.push("email");
  const expiryOverride = Number(formData.get("expiryMinutesOverride") ?? 0);

  const settings = await getEffectiveInviteSettings(gameId);
  if (!settings) return { ok: false, error: "Game not found." };

  let playerIds: string[];
  if (mode === "fcfs") {
    // Send to every eligible league member (in-pool list).
    const [g] = await db
      .select({ leagueId: games.leagueId })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);
    if (!g?.leagueId) return { ok: false, error: "Game has no league." };
    const memberRows = await db
      .select({ playerId: sql<string>`league_players.player_id` })
      .from(sql`league_players`)
      .where(sql`league_players.league_id = ${g.leagueId}`);
    const allMemberIds = memberRows.map((r) => r.playerId);
    // Exclude already on roster or active invites.
    const onRoster = await db
      .select({ playerId: gameRoster.playerId })
      .from(gameRoster)
      .where(eq(gameRoster.gameId, gameId));
    const active = await db
      .select({ playerId: gameInvites.playerId })
      .from(gameInvites)
      .where(
        and(
          eq(gameInvites.gameId, gameId),
          inArray(gameInvites.state, ["queued", "pending"]),
        ),
      );
    const skip = new Set([
      ...onRoster.map((r) => r.playerId),
      ...active.map((r) => r.playerId),
    ]);
    playerIds = allMemberIds.filter((id) => !skip.has(id));
  } else {
    const csv = String(formData.get("playerIds") ?? "");
    playerIds = csv.split(",").map((s) => s.trim()).filter(Boolean);
    if (playerIds.length === 0) {
      return { ok: false, error: "Pick at least one player." };
    }
    // Drop any already-active or rostered.
    const onRoster = await db
      .select({ playerId: gameRoster.playerId })
      .from(gameRoster)
      .where(eq(gameRoster.gameId, gameId));
    const active = await db
      .select({ playerId: gameInvites.playerId })
      .from(gameInvites)
      .where(
        and(
          eq(gameInvites.gameId, gameId),
          inArray(gameInvites.state, ["queued", "pending"]),
        ),
      );
    const skip = new Set([
      ...onRoster.map((r) => r.playerId),
      ...active.map((r) => r.playerId),
    ]);
    playerIds = playerIds.filter((id) => !skip.has(id));
  }
  if (playerIds.length === 0) {
    return { ok: false, error: "No eligible recipients (already invited or on roster)." };
  }

  const expiryMin =
    expiryOverride > 0 && expiryOverride <= 24 * 60
      ? expiryOverride
      : settings.expiryMinutes;

  // Create the batch + invites in one go.
  const [batch] = await db
    .insert(gameInviteBatches)
    .values({ gameId, mode, createdBy: gate.session.playerId ?? null })
    .returning({ id: gameInviteBatches.id });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMin * 60_000);
  const rows = playerIds.map((playerId) => ({
    gameId,
    playerId,
    batchId: batch.id,
    mode,
    state: "pending" as const,
    channels,
    sentAt: now,
    deliveredAt: now, // optimistic — Resend doesn't give per-message webhooks here
    expiresAt,
    claimToken: newToken(),
    createdBy: gate.session.playerId ?? null,
  }));
  const inserted = await db
    .insert(gameInvites)
    .values(rows)
    .returning();

  // Log + send email per invite. Email failures are best-effort.
  for (const inv of inserted) {
    await logEvent(inv.id, gameId, "invite.sent", gate.session.playerId ?? null);
    if (channels.includes("email")) {
      const ctx = await inviteEmailContext(inv);
      if (ctx) {
        // Fire-and-forget so a slow Resend response doesn't block the action.
        void sendInviteInitial(ctx);
      }
    }
  }

  revalidatePath(`/games/${gameId}`);
  return { ok: true, data: { count: inserted.length, batchId: batch.id } };
}

export async function cancelInvite(id: string): Promise<ActionResult> {
  const [inv] = await db
    .select({ id: gameInvites.id, gameId: gameInvites.gameId, state: gameInvites.state })
    .from(gameInvites)
    .where(eq(gameInvites.id, id))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  const gate = await gateGameManager(inv.gameId);
  if (!gate.ok) return gate;
  if (inv.state !== "queued" && inv.state !== "pending") {
    return { ok: false, error: "Only pending invites can be cancelled." };
  }
  await db
    .update(gameInvites)
    .set({ state: "cancelled", respondedAt: new Date() })
    .where(eq(gameInvites.id, id));
  await logEvent(id, inv.gameId, "invite.cancelled", gate.session.playerId ?? null);
  revalidatePath(`/games/${inv.gameId}`);
  return { ok: true };
}

export async function resendInvite(id: string): Promise<ActionResult<{ id: string }>> {
  const [inv] = await db
    .select()
    .from(gameInvites)
    .where(eq(gameInvites.id, id))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  const gate = await gateGameManager(inv.gameId);
  if (!gate.ok) return gate;

  const settings = await getEffectiveInviteSettings(inv.gameId);
  if (!settings) return { ok: false, error: "Game settings not found." };

  // Mark old as superseded (keep history).
  await db
    .update(gameInvites)
    .set({ state: "superseded" })
    .where(eq(gameInvites.id, id));
  await logEvent(id, inv.gameId, "invite.resent", gate.session.playerId ?? null);

  const now = new Date();
  const [fresh] = await db
    .insert(gameInvites)
    .values({
      gameId: inv.gameId,
      playerId: inv.playerId,
      batchId: inv.batchId,
      mode: inv.mode,
      state: "pending",
      channels: inv.channels,
      sentAt: now,
      deliveredAt: now,
      expiresAt: new Date(now.getTime() + settings.expiryMinutes * 60_000),
      claimToken: newToken(),
      createdBy: gate.session.playerId ?? null,
    })
    .returning();
  await logEvent(fresh.id, inv.gameId, "invite.sent", gate.session.playerId ?? null, "resend");

  if (fresh.channels.includes("email")) {
    const ctx = await inviteEmailContext(fresh);
    if (ctx) void sendInviteInitial(ctx);
  }
  revalidatePath(`/games/${inv.gameId}`);
  return { ok: true, data: { id: fresh.id } };
}

export async function extendInvite(id: string): Promise<ActionResult> {
  const [inv] = await db
    .select()
    .from(gameInvites)
    .where(eq(gameInvites.id, id))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  const gate = await gateGameManager(inv.gameId);
  if (!gate.ok) return gate;
  if (inv.state !== "pending") {
    return { ok: false, error: "Only pending invites can be extended." };
  }
  if (inv.extendedCount >= 1) {
    return { ok: false, error: "This invite has already been extended once." };
  }
  const settings = await getEffectiveInviteSettings(inv.gameId);
  if (!settings) return { ok: false, error: "Game settings not found." };
  const newExpires = new Date(
    (inv.expiresAt ?? new Date()).getTime() +
      settings.expiryMinutes * 60_000,
  );
  await db
    .update(gameInvites)
    .set({ expiresAt: newExpires, extendedCount: 1 })
    .where(eq(gameInvites.id, id));
  await logEvent(id, inv.gameId, "invite.extended", gate.session.playerId ?? null);
  revalidatePath(`/games/${inv.gameId}`);
  return { ok: true };
}

export async function bulkCancelGameInvites(gameId: string): Promise<ActionResult> {
  const gate = await gateGameManager(gameId);
  if (!gate.ok) return gate;
  const open = await db
    .select({ id: gameInvites.id })
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.gameId, gameId),
        inArray(gameInvites.state, ["queued", "pending"]),
      ),
    );
  if (open.length === 0) return { ok: true };
  await db
    .update(gameInvites)
    .set({ state: "cancelled", respondedAt: new Date() })
    .where(
      and(
        eq(gameInvites.gameId, gameId),
        inArray(gameInvites.state, ["queued", "pending"]),
      ),
    );
  for (const r of open) {
    await logEvent(
      r.id,
      gameId,
      "invite.cancelled",
      gate.session.playerId ?? null,
      "bulk",
    );
  }
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}

/* ---------- Public claim actions (used by /i/[token] page) ---------- */

export async function acceptInviteByToken(token: string): Promise<ActionResult> {
  const [inv] = await db
    .select()
    .from(gameInvites)
    .where(eq(gameInvites.claimToken, token))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (inv.state === "confirmed") return { ok: true };
  if (inv.state !== "pending") {
    return { ok: false, error: `Invite is ${inv.state}.` };
  }
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
    await db
      .update(gameInvites)
      .set({ state: "expired" })
      .where(eq(gameInvites.id, inv.id));
    await logEvent(inv.id, inv.gameId, "invite.expired", null);
    return { ok: false, error: "Invite expired." };
  }

  // Capacity check.
  const settings = await getEffectiveInviteSettings(inv.gameId);
  if (!settings) return { ok: false, error: "Game settings not found." };
  const counts = await getConfirmedCounts(inv.gameId);
  if (counts.total >= settings.targetSeats) {
    // Move to declined-state semantics with a note; FCFS auto-cancel
    // would normally have closed this invite, so this only triggers
    // for Single/Group acceptances after capacity.
    await db
      .update(gameInvites)
      .set({ state: "cancelled", respondedAt: new Date() })
      .where(eq(gameInvites.id, inv.id));
    await logEvent(inv.id, inv.gameId, "game.capacity_hit", null, "late accept");
    const ctx = await inviteEmailContext(inv);
    if (ctx) void sendSeatsFilledNotice(ctx);
    return { ok: false, error: "Seats already filled." };
  }

  await db
    .update(gameInvites)
    .set({ state: "confirmed", respondedAt: new Date() })
    .where(eq(gameInvites.id, inv.id));
  await logEvent(inv.id, inv.gameId, "invite.accepted", null);

  // Drop them onto the roster on whichever side has fewer players.
  const roster = await db
    .select({ side: gameRoster.side })
    .from(gameRoster)
    .where(eq(gameRoster.gameId, inv.gameId));
  const aCount = roster.filter((r) => r.side === "A").length;
  const bCount = roster.filter((r) => r.side === "B").length;
  const side: "A" | "B" = aCount <= bCount ? "A" : "B";
  await db
    .insert(gameRoster)
    .values({ gameId: inv.gameId, playerId: inv.playerId, side })
    .onConflictDoUpdate({
      target: [gameRoster.gameId, gameRoster.playerId],
      set: { side },
    });
  await db
    .update(gameInvites)
    .set({ assignedTeam: side })
    .where(eq(gameInvites.id, inv.id));

  // FCFS: if capacity now hit, auto-cancel remaining pendings.
  const next = await getConfirmedCounts(inv.gameId);
  if (next.total >= settings.targetSeats && settings.fcfsEnabled) {
    const stale = await db
      .select({ id: gameInvites.id })
      .from(gameInvites)
      .where(
        and(
          eq(gameInvites.gameId, inv.gameId),
          inArray(gameInvites.state, ["pending", "queued"]),
        ),
      );
    if (stale.length > 0) {
      await db
        .update(gameInvites)
        .set({ state: "cancelled" })
        .where(
          and(
            eq(gameInvites.gameId, inv.gameId),
            inArray(gameInvites.state, ["pending", "queued"]),
          ),
        );
      for (const s of stale) {
        await logEvent(s.id, inv.gameId, "invite.cancelled", null, "capacity");
      }
    }
    await logEvent(inv.id, inv.gameId, "game.capacity_hit", null);
  }

  revalidatePath(`/games/${inv.gameId}`);
  return { ok: true };
}

export async function declineInviteByToken(token: string): Promise<ActionResult> {
  const [inv] = await db
    .select()
    .from(gameInvites)
    .where(eq(gameInvites.claimToken, token))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (inv.state === "declined") return { ok: true };
  if (inv.state !== "pending") {
    return { ok: false, error: `Invite is ${inv.state}.` };
  }
  await db
    .update(gameInvites)
    .set({ state: "declined", respondedAt: new Date() })
    .where(eq(gameInvites.id, inv.id));
  await logEvent(inv.id, inv.gameId, "invite.declined", null);

  // Auto-backfill if enabled.
  const settings = await getEffectiveInviteSettings(inv.gameId);
  if (settings?.autoBackfill) {
    void triggerBackfill(inv.gameId);
  }
  revalidatePath(`/games/${inv.gameId}`);
  return { ok: true };
}

/**
 * Pick the next eligible league member and send them an invite.
 * Ranking v1 = simple: most-recent league players who aren't on
 * the roster and don't have an active invite. Win-rate / decline-
 * rate weights deferred to v1.1.
 */
async function triggerBackfill(gameId: string) {
  const [g] = await db
    .select({ leagueId: games.leagueId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!g?.leagueId) return;
  const settings = await getEffectiveInviteSettings(gameId);
  if (!settings) return;
  const counts = await getConfirmedCounts(gameId);
  if (counts.total >= settings.targetSeats) return;

  const memberRows = await db
    .select({ playerId: sql<string>`league_players.player_id` })
    .from(sql`league_players`)
    .where(sql`league_players.league_id = ${g.leagueId}`);
  const onRoster = await db
    .select({ playerId: gameRoster.playerId })
    .from(gameRoster)
    .where(eq(gameRoster.gameId, gameId));
  const active = await db
    .select({ playerId: gameInvites.playerId })
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.gameId, gameId),
        inArray(gameInvites.state, ["queued", "pending"]),
      ),
    );
  const skip = new Set([
    ...onRoster.map((r) => r.playerId),
    ...active.map((r) => r.playerId),
  ]);
  const recentlyDeclined = await db
    .select({ playerId: gameInvites.playerId })
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.gameId, gameId),
        inArray(gameInvites.state, ["declined", "expired", "cancelled", "superseded"]),
      ),
    );
  const declinedSet = new Set(recentlyDeclined.map((r) => r.playerId));
  const candidate = memberRows
    .map((r) => r.playerId)
    .find((id) => !skip.has(id) && !declinedSet.has(id));
  if (!candidate) return;

  const [batch] = await db
    .insert(gameInviteBatches)
    .values({ gameId, mode: "backfill" })
    .returning({ id: gameInviteBatches.id });
  const now = new Date();
  const [fresh] = await db
    .insert(gameInvites)
    .values({
      gameId,
      playerId: candidate,
      batchId: batch.id,
      mode: "backfill",
      state: "pending",
      channels: ["email"],
      sentAt: now,
      deliveredAt: now,
      expiresAt: new Date(now.getTime() + settings.expiryMinutes * 60_000),
      claimToken: newToken(),
    })
    .returning();
  await logEvent(fresh.id, gameId, "invite.sent", null, "auto-backfill");
  const ctx = await inviteEmailContext(fresh);
  if (ctx) void sendInviteInitial(ctx);
}

/* ---------- Cron: sweep expirations & reminders ---------- */

/**
 * Idempotent sweep called by a Vercel Cron every minute. Two passes:
 * (1) flip pending invites whose expires_at has passed to expired
 *     and trigger auto-backfill if enabled.
 * (2) send reminders for invites whose reminder_sent_at is null and
 *     whose expires_at is within reminderLeadMinutes from now.
 */
export async function sweepInviteExpirations(): Promise<{
  expired: number;
  reminders: number;
}> {
  const now = new Date();

  // (1) Expire.
  const dueExpiry = await db
    .select({ id: gameInvites.id, gameId: gameInvites.gameId })
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.state, "pending"),
        lt(gameInvites.expiresAt, now),
      ),
    );
  if (dueExpiry.length > 0) {
    await db
      .update(gameInvites)
      .set({ state: "expired" })
      .where(
        and(
          eq(gameInvites.state, "pending"),
          lt(gameInvites.expiresAt, now),
        ),
      );
    for (const r of dueExpiry) {
      await logEvent(r.id, r.gameId, "invite.expired", null);
    }
    // Per-game, kick off backfill where enabled.
    const gameIds = Array.from(new Set(dueExpiry.map((r) => r.gameId)));
    for (const gid of gameIds) {
      const s = await getEffectiveInviteSettings(gid);
      if (s?.autoBackfill) void triggerBackfill(gid);
    }
  }

  // (2) Reminders. Send when expires_at - reminderLead <= now < expires_at
  // and reminder_sent_at IS NULL.
  const all = await db
    .select()
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.state, "pending"),
        sql`${gameInvites.reminderSentAt} IS NULL`,
        sql`${gameInvites.expiresAt} > ${now}`,
      ),
    );
  let reminders = 0;
  for (const inv of all) {
    if (!inv.expiresAt) continue;
    const settings = await getEffectiveInviteSettings(inv.gameId);
    if (!settings) continue;
    const lead = settings.reminderLeadMinutes;
    const sendAfter = new Date(
      inv.expiresAt.getTime() - lead * 60_000,
    );
    if (now < sendAfter) continue;
    await db
      .update(gameInvites)
      .set({ reminderSentAt: now })
      .where(eq(gameInvites.id, inv.id));
    if ((inv.channels ?? []).includes("email")) {
      const ctx = await inviteEmailContext(inv);
      if (ctx) void sendInviteReminder(ctx);
    }
    await logEvent(inv.id, inv.gameId, "invite.reminded", null);
    reminders++;
  }

  return { expired: dueExpiry.length, reminders };
}
