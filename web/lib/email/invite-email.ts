/**
 * Invite-related transactional email helpers. Mirrors the Resend
 * pattern used by lib/auth/password-reset.ts (raw fetch, no SDK).
 *
 * Mail is best-effort: if RESEND_API_KEY / ADMIN_FROM_EMAIL are
 * missing the call logs the URL and returns. Callers should not
 * await failure as a hard error — invite state still progresses.
 */
const escapeHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type InviteEmailContext = {
  to: string;
  firstName: string;
  leagueName: string;
  gameDateLabel: string; // pre-formatted: "Wed · Apr 29 · 7:00 PM"
  venue: string | null;
  claimUrl: string;
  expiresAtLabel: string; // "in 2h" or absolute time
  teamAName: string;
  teamBName: string;
  customMessage?: string | null; // commissioner-authored body; {firstName} substituted
};

/** Returns true when both Resend secrets are present in the env. */
export function isInviteEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.ADMIN_FROM_EMAIL,
  );
}

async function send({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn(
      "[invite-email] RESEND_API_KEY or ADMIN_FROM_EMAIL missing; skipping",
      { to, subject },
    );
    return { ok: false, error: "email_not_configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[invite-email] resend rejected", res.status, body);
      return { ok: false, error: `resend_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[invite-email] send failed", err);
    return { ok: false, error: "network" };
  }
}

const wrapHtml = (inner: string) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;color:#0a0a0a;">
  ${inner}
  <p style="color:#666;font-size:12px;margin-top:24px;">— BDL · Ball Don't Lie</p>
</div>`;

const fillTemplate = (s: string, ctx: InviteEmailContext) =>
  s
    .replace(/\{firstName\}/g, ctx.firstName)
    .replace(/\{leagueName\}/g, ctx.leagueName)
    .replace(/\{gameDate\}/g, ctx.gameDateLabel)
    .replace(/\{venue\}/g, ctx.venue ?? "")
    .replace(/\{claimUrl\}/g, ctx.claimUrl)
    .replace(/\{expires\}/g, ctx.expiresAtLabel);

export function sendInviteInitial(ctx: InviteEmailContext) {
  const subject = `${ctx.leagueName}: invite for ${ctx.gameDateLabel}`;
  const customBody = ctx.customMessage ? fillTemplate(ctx.customMessage, ctx) : null;
  const venueLine = ctx.venue ? ` @ ${ctx.venue}` : "";
  const defaultText =
    `Hi ${ctx.firstName},\n\n` +
    `You're invited to ${ctx.leagueName} — ${ctx.gameDateLabel}${venueLine}.\n\n` +
    `Claim or pass: ${ctx.claimUrl}\n` +
    `Invite expires ${ctx.expiresAtLabel}.\n\n— BDL`;
  const text = customBody
    ? `${customBody}\n\nClaim or pass: ${ctx.claimUrl}\nInvite expires ${ctx.expiresAtLabel}.\n\n— BDL`
    : defaultText;
  const bodyHtml = customBody
    ? `<div style="font-size:14px;line-height:1.55;white-space:pre-wrap;margin:0 0 18px;">${escapeHtml(customBody)}</div>`
    : `
      <p style="font-size:15px;margin:0 0 4px;">${escapeHtml(ctx.gameDateLabel)}</p>
      ${ctx.venue ? `<p style="font-size:13px;color:#555;margin:0 0 16px;">${escapeHtml(ctx.venue)}</p>` : ""}
    `;
  const html = wrapHtml(`
    <h2 style="margin:0 0 6px;font-size:18px;letter-spacing:-0.01em;">You're invited</h2>
    <p style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#666;margin:0 0 16px;">${escapeHtml(ctx.leagueName)}</p>
    ${bodyHtml}
    <p style="margin:20px 0;">
      <a href="${escapeHtml(ctx.claimUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Claim a seat</a>
    </p>
    <p style="color:#666;font-size:13px;margin:0;">Or paste this URL: <a href="${escapeHtml(ctx.claimUrl)}">${escapeHtml(ctx.claimUrl)}</a></p>
    <p style="color:#888;font-size:12px;margin-top:14px;">Invite expires ${escapeHtml(ctx.expiresAtLabel)}.</p>
  `);
  return send({ to: ctx.to, subject, text, html });
}

/**
 * SMS stub. Real Twilio wiring is deferred; for now we log so the
 * invite still gets recorded with `sms` in its channels[] and we can
 * backfill once credentials are configured.
 */
export async function sendInviteSMS(opts: {
  to: string;
  body: string;
}) {
  console.info("[invite-sms] (stub) would send SMS", {
    to: opts.to,
    body: opts.body.slice(0, 160),
  });
}

export function sendInviteReminder(ctx: InviteEmailContext) {
  const subject = `Reminder: ${ctx.leagueName} invite expires soon`;
  const text =
    `Hi ${ctx.firstName},\n\n` +
    `Your invite to ${ctx.leagueName} (${ctx.gameDateLabel}) expires soon. ` +
    `Claim or pass: ${ctx.claimUrl}\n\n— BDL`;
  const html = wrapHtml(`
    <h2 style="margin:0 0 12px;font-size:18px;">Heads up — your invite expires soon</h2>
    <p>Your invite to <strong>${escapeHtml(ctx.leagueName)}</strong> on ${escapeHtml(ctx.gameDateLabel)} ${ctx.venue ? `at ${escapeHtml(ctx.venue)}` : ""} expires shortly.</p>
    <p style="margin:18px 0;">
      <a href="${escapeHtml(ctx.claimUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">Claim a seat</a>
    </p>
  `);
  return send({ to: ctx.to, subject, text, html });
}

/**
 * League-join invite email — sent from the league detail page when a
 * commissioner generates an invite link for a new player. Distinct
 * from the game-invite emails above: this one invites someone to
 * JOIN the league, not claim a seat for a specific game.
 */
export type LeagueJoinEmailContext = {
  to: string;
  firstName: string;
  leagueName: string;
  /** Full URL to the public invite-accept page (/invite/{id}). */
  claimUrl: string;
  /** Optional commissioner display name to put in the body ("from X"). */
  invitedByName?: string | null;
};

export function sendLeagueJoinInvite(ctx: LeagueJoinEmailContext) {
  const subject = `You're invited to join ${ctx.leagueName} on BDL`;
  const fromLine = ctx.invitedByName
    ? `${ctx.invitedByName} invited you to join `
    : "You've been invited to join ";
  const text =
    `Hi ${ctx.firstName},\n\n` +
    `${fromLine}${ctx.leagueName} on BDL — Ball Don't Lie.\n\n` +
    `Accept the invite and create your player profile here:\n${ctx.claimUrl}\n\n— BDL`;
  const html = wrapHtml(`
    <h2 style="margin:0 0 6px;font-size:18px;letter-spacing:-0.01em;">You're invited to join</h2>
    <p style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#666;margin:0 0 16px;">${escapeHtml(ctx.leagueName)}</p>
    <p style="font-size:14px;line-height:1.55;margin:0 0 6px;">Hi ${escapeHtml(ctx.firstName)},</p>
    <p style="font-size:14px;line-height:1.55;margin:0 0 18px;">
      ${escapeHtml(fromLine)}<strong>${escapeHtml(ctx.leagueName)}</strong> on BDL — Ball Don't Lie.
      Accept below to create your player profile and lock in your spot.
    </p>
    <p style="margin:20px 0;">
      <a href="${escapeHtml(ctx.claimUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Accept invite</a>
    </p>
    <p style="color:#666;font-size:13px;margin:0;">Or paste this URL into your browser:<br/><a href="${escapeHtml(ctx.claimUrl)}">${escapeHtml(ctx.claimUrl)}</a></p>
  `);
  return send({ to: ctx.to, subject, text, html });
}

export function sendSeatsFilledNotice(ctx: Omit<InviteEmailContext, "expiresAtLabel" | "teamAName" | "teamBName">) {
  const subject = `${ctx.leagueName}: seats filled`;
  const text =
    `Hi ${ctx.firstName},\n\n` +
    `Thanks for the quick reply — seats for ${ctx.leagueName} (${ctx.gameDateLabel}) ` +
    `are already filled. We've added you to the waitlist.\n\n— BDL`;
  const html = wrapHtml(`
    <h2 style="margin:0 0 10px;font-size:18px;">Seats already filled</h2>
    <p>Thanks for jumping on it — ${escapeHtml(ctx.leagueName)} on ${escapeHtml(ctx.gameDateLabel)} is full. You're on the waitlist.</p>
  `);
  return send({ to: ctx.to, subject, text, html });
}
