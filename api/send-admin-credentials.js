// POST /api/send-admin-credentials
// Sends Super Admin login credentials via Resend.
//
// Required Vercel environment variables:
//   RESEND_API_KEY     — your Resend API key (https://resend.com/api-keys)
//   ADMIN_FROM_EMAIL   — verified sender, e.g. "BDL Pickup <admin@yourdomain.com>"
//
// Optional:
//   ADMIN_ALLOWED_ORIGIN — restrict calls to this origin (defaults to same-origin only)

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allowedOrigin = process.env.ADMIN_ALLOWED_ORIGIN;
  if (allowedOrigin) {
    const origin = req.headers.origin || '';
    if (origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  }

  const { firstName, lastName, email, username, password, loginUrl } = req.body || {};

  if (!firstName || !lastName || !username || !password) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.ADMIN_FROM_EMAIL;
  if (!apiKey || !fromAddress) {
    return res.status(500).json({
      error: 'Email service is not configured. Set RESEND_API_KEY and ADMIN_FROM_EMAIL in Vercel env.',
    });
  }

  const safeUrl = typeof loginUrl === 'string' ? loginUrl : '';
  const text =
    `Hi ${firstName},\n\n` +
    `You've been added as a Super Admin on BDL Pickup. You now have full access to Roster, Leagues, Games, and Settings.\n\n` +
    (safeUrl ? `Login URL: ${safeUrl}\n` : '') +
    `Username: ${username}\n` +
    `Password: ${password}\n\n` +
    `Keep these credentials secure.\n\n— BDL Pickup`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;color:#111;">
    <h2 style="margin:0 0 12px;font-size:20px;">You're a BDL Pickup Super Admin</h2>
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>You've been added as a Super Admin on BDL Pickup. You now have full access to Roster, Leagues, Games, and Settings.</p>
    <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;">
      ${safeUrl ? `<div style="margin-bottom:6px;"><strong>Login URL:</strong> <a href="${escapeHtml(safeUrl)}">${escapeHtml(safeUrl)}</a></div>` : ''}
      <div style="margin-bottom:6px;"><strong>Username:</strong> ${escapeHtml(username)}</div>
      <div><strong>Password:</strong> ${escapeHtml(password)}</div>
    </div>
    <p style="color:#666;font-size:13px;">Keep these credentials secure.</p>
    <p style="color:#666;font-size:13px;">&mdash; BDL Pickup</p>
  </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: 'Your BDL Pickup Super Admin Login',
        text,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Resend request failed.',
      });
    }
    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
}
