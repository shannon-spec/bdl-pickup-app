// POST /api/send-admin-credentials
// Sends Super Admin login credentials via Resend.
//
// Required env:
//   RESEND_API_KEY     — https://resend.com/api-keys
//   ADMIN_FROM_EMAIL   — verified sender, e.g. "BDL Pickup <admin@yourdomain.com>"
// Optional:
//   ADMIN_ALLOWED_ORIGIN — restrict calls to this origin

import { NextResponse } from "next/server";

const escapeHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

type Body = {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  password?: string;
  loginUrl?: string;
};

export async function POST(request: Request) {
  const allowedOrigin = process.env.ADMIN_ALLOWED_ORIGIN;
  if (allowedOrigin) {
    const origin = request.headers.get("origin") || "";
    if (origin !== allowedOrigin) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { firstName, lastName, email, username, password, loginUrl } = body;

  if (!firstName || !lastName || !username || !password) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.ADMIN_FROM_EMAIL;
  if (!apiKey || !fromAddress) {
    return NextResponse.json(
      {
        error:
          "Email service is not configured. Set RESEND_API_KEY and ADMIN_FROM_EMAIL in Vercel env.",
      },
      { status: 500 },
    );
  }

  const safeUrl = typeof loginUrl === "string" ? loginUrl : "";
  const text =
    `Hi ${firstName},\n\n` +
    `You've been added as a Super Admin on BDL Pickup. You now have full access to Roster, Leagues, Games, and Settings.\n\n` +
    (safeUrl ? `Login URL: ${safeUrl}\n` : "") +
    `Username: ${username}\n` +
    `Password: ${password}\n\n` +
    `Keep these credentials secure.\n\n— BDL Pickup`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;color:#111;">
    <h2 style="margin:0 0 12px;font-size:20px;">You're a BDL Pickup Super Admin</h2>
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>You've been added as a Super Admin on BDL Pickup. You now have full access to Roster, Leagues, Games, and Settings.</p>
    <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;">
      ${safeUrl ? `<div style="margin-bottom:6px;"><strong>Login URL:</strong> <a href="${escapeHtml(safeUrl)}">${escapeHtml(safeUrl)}</a></div>` : ""}
      <div style="margin-bottom:6px;"><strong>Username:</strong> ${escapeHtml(username)}</div>
      <div><strong>Password:</strong> ${escapeHtml(password)}</div>
    </div>
    <p style="color:#666;font-size:13px;">Keep these credentials secure.</p>
    <p style="color:#666;font-size:13px;">&mdash; BDL Pickup</p>
  </div>`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: "Your BDL Pickup Super Admin Login",
        text,
        html,
      }),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: string;
    };
    if (!resp.ok) {
      return NextResponse.json(
        { error: data?.message || data?.error || "Resend request failed." },
        { status: resp.status },
      );
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message || "Unexpected error" },
      { status: 500 },
    );
  }
}
