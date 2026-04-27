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
};

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
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn(
      "[invite-email] RESEND_API_KEY or ADMIN_FROM_EMAIL missing; skipping",
      { to, subject },
    );
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  }).catch((err) => {
    console.error("[invite-email] send failed", err);
  });
}

const wrapHtml = (inner: string) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;color:#0a0a0a;">
  ${inner}
  <p style="color:#666;font-size:12px;margin-top:24px;">— BDL · Ball Don't Lie</p>
</div>`;

export function sendInviteInitial(ctx: InviteEmailContext) {
  const subject = `${ctx.leagueName}: invite for ${ctx.gameDateLabel}`;
  const venueLine = ctx.venue ? ` @ ${ctx.venue}` : "";
  const text =
    `Hi ${ctx.firstName},\n\n` +
    `You're invited to ${ctx.leagueName} — ${ctx.gameDateLabel}${venueLine}.\n\n` +
    `Claim or pass: ${ctx.claimUrl}\n` +
    `Invite expires ${ctx.expiresAtLabel}.\n\n— BDL`;
  const html = wrapHtml(`
    <h2 style="margin:0 0 6px;font-size:18px;letter-spacing:-0.01em;">You're invited</h2>
    <p style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#666;margin:0 0 16px;">${escapeHtml(ctx.leagueName)}</p>
    <p style="font-size:15px;margin:0 0 4px;">${escapeHtml(ctx.gameDateLabel)}</p>
    ${ctx.venue ? `<p style="font-size:13px;color:#555;margin:0 0 16px;">${escapeHtml(ctx.venue)}</p>` : ""}
    <p style="margin:20px 0;">
      <a href="${escapeHtml(ctx.claimUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Claim a seat</a>
    </p>
    <p style="color:#666;font-size:13px;margin:0;">Or paste this URL: <a href="${escapeHtml(ctx.claimUrl)}">${escapeHtml(ctx.claimUrl)}</a></p>
    <p style="color:#888;font-size:12px;margin-top:14px;">Invite expires ${escapeHtml(ctx.expiresAtLabel)}.</p>
  `);
  return send({ to: ctx.to, subject, text, html });
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
