"use server";

import { randomBytes } from "node:crypto";
import { eq, isNotNull, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db, players, passwordResetTokens } from "@/lib/db";
import { readSession } from "./session";

const TOKEN_TTL_MIN = 30;
const MIN_PASSWORD_LEN = 8;

const escapeHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function getBaseUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function sendResetEmail(args: {
  to: string;
  firstName: string;
  resetUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.ADMIN_FROM_EMAIL;
  if (!apiKey || !fromAddress) {
    // Mail not configured — log so operators see it during dev.
    console.warn(
      "[password-reset] RESEND_API_KEY or ADMIN_FROM_EMAIL missing; reset URL =",
      args.resetUrl,
    );
    return;
  }

  const text =
    `Hi ${args.firstName},\n\n` +
    `Someone requested a password reset for your BDL Pickup account. ` +
    `If that was you, follow this link to set a new password:\n\n` +
    `${args.resetUrl}\n\n` +
    `This link expires in ${TOKEN_TTL_MIN} minutes and can only be used once. ` +
    `If you didn't request this, you can ignore this email.\n\n— BDL Pickup`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;color:#111;">
    <h2 style="margin:0 0 12px;font-size:20px;">Reset your BDL Pickup password</h2>
    <p>Hi ${escapeHtml(args.firstName)},</p>
    <p>Someone requested a password reset for your account. If that was you, click the button below to set a new password.</p>
    <p style="margin:20px 0;">
      <a href="${escapeHtml(args.resetUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Reset password</a>
    </p>
    <p style="color:#666;font-size:13px;">Or paste this URL into your browser:<br/><a href="${escapeHtml(args.resetUrl)}">${escapeHtml(args.resetUrl)}</a></p>
    <p style="color:#666;font-size:13px;">This link expires in ${TOKEN_TTL_MIN} minutes and can only be used once. If you didn't request this, you can ignore this email.</p>
    <p style="color:#666;font-size:13px;">&mdash; BDL Pickup</p>
  </div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [args.to],
      subject: "Reset your BDL Pickup password",
      text,
      html,
    }),
  }).catch((err) => {
    console.error("[password-reset] Resend send failed:", err);
  });
}

/**
 * Begin a password reset. Always returns ok so attackers can't probe
 * which emails are registered. Real work only happens when the email
 * matches a player who has a username (i.e. has credentials).
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ ok: true }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: true };

  const [player] = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      email: players.email,
    })
    .from(players)
    .where(and(eq(players.email, email), isNotNull(players.username)))
    .limit(1);

  if (player && player.email) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);
    await db
      .insert(passwordResetTokens)
      .values({ token, playerId: player.id, expiresAt });

    const baseUrl = await getBaseUrl();
    const resetUrl = `${baseUrl}/reset/${token}`;
    await sendResetEmail({
      to: player.email,
      firstName: player.firstName,
      resetUrl,
    });
  }

  return { ok: true };
}

/**
 * Returns whether a reset token is still claimable (exists, not used,
 * not expired). Used by the reset page server-side to either show the
 * form or an "expired" message before any submit.
 */
export async function getResetTokenStatus(
  token: string,
): Promise<"valid" | "used" | "expired" | "missing"> {
  if (!token) return "missing";
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  if (!row) return "missing";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() < Date.now()) return "expired";
  return "valid";
}

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetPassword(
  formData: FormData,
): Promise<ResetResult> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, error: "Missing reset token." };
  if (password.length < MIN_PASSWORD_LEN) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
    };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords don't match." };
  }

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!row) return { ok: false, error: "Reset link is invalid." };
  if (row.usedAt) return { ok: false, error: "Reset link already used." };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Reset link expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(players)
    .set({ passwordHash })
    .where(eq(players.id, row.playerId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));

  return { ok: true };
}

/**
 * Signed-in self-serve password change. Requires the player to enter
 * their current password (defense against session hijack / shared
 * device). Super admins use a shared-password env gate, so this only
 * applies to player accounts.
 */
export async function changePassword(
  formData: FormData,
): Promise<ResetResult> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in to change your password." };
  }

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current) return { ok: false, error: "Enter your current password." };
  if (password.length < MIN_PASSWORD_LEN) {
    return {
      ok: false,
      error: `New password must be at least ${MIN_PASSWORD_LEN} characters.`,
    };
  }
  if (password !== confirm) {
    return { ok: false, error: "New passwords don't match." };
  }
  if (current === password) {
    return {
      ok: false,
      error: "New password must be different from your current one.",
    };
  }

  const [player] = await db
    .select({ id: players.id, passwordHash: players.passwordHash })
    .from(players)
    .where(eq(players.id, session.playerId))
    .limit(1);

  if (!player || !player.passwordHash) {
    return { ok: false, error: "Account has no password set." };
  }
  const ok = await bcrypt.compare(current, player.passwordHash);
  if (!ok) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(players)
    .set({ passwordHash })
    .where(eq(players.id, player.id));

  return { ok: true };
}
