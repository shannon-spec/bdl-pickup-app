"use server";

import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db, players, authOtp } from "@/lib/db";
import { emailHash, encryptOptional } from "@/lib/crypto/secrets";
import { createSession, writeSessionCookie } from "./session";

const CODE_TTL_MIN = 10;
const MAX_SENDS_PER_WINDOW = 5; // per identifier, per window
const SEND_WINDOW_MIN = 15;
const MAX_VERIFY_ATTEMPTS = 5;

export type OtpRequestResult =
  | { ok: true; delivered: boolean; devCode?: string }
  | { ok: false; error: string };

export type OtpVerifyResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

const devMode = () =>
  process.env.NODE_ENV !== "production" || process.env.OTP_DEV_MODE === "1";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || "unknown";
}

/* ---- shared code issue/verify (keyed by a hashed identifier) ---- */

async function issueCode(idHash: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const since = new Date(Date.now() - SEND_WINDOW_MIN * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authOtp)
    .where(and(eq(authOtp.phoneHash, idHash), gt(authOtp.createdAt, since)));
  if (count >= MAX_SENDS_PER_WINDOW) {
    return { ok: false, error: "Too many codes requested. Wait a few minutes and try again." };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);
  await db.insert(authOtp).values({
    phoneHash: idHash,
    codeHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000),
    requestIp: await clientIp(),
  });
  return { ok: true, code };
}

async function matchCode(idHash: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db
    .select()
    .from(authOtp)
    .where(and(eq(authOtp.phoneHash, idHash), isNull(authOtp.consumedAt)))
    .orderBy(desc(authOtp.createdAt))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Code expired — request a new one." };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many tries. Request a new code." };
  }
  const clean = (code ?? "").replace(/\D/g, "");
  const matches = await bcrypt.compare(clean, row.codeHash);
  if (!matches) {
    await db.update(authOtp).set({ attempts: row.attempts + 1 }).where(eq(authOtp.id, row.id));
    return { ok: false, error: "That code isn't right. Try again." };
  }
  await db.update(authOtp).set({ consumedAt: new Date() }).where(eq(authOtp.id, row.id));
  return { ok: true };
}

function redirectFor(isNew: boolean, hasName: boolean, opts: { intent?: string; next?: string }): string {
  const needsWelcome = isNew || !hasName;
  const intentQs = opts.intent ? `?intent=${encodeURIComponent(opts.intent)}` : "";
  if (needsWelcome) return `/welcome${intentQs}`;
  return opts.next && opts.next.startsWith("/") ? opts.next : "/home";
}

/* =================== EMAIL OTP (primary) =================== */

const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const emailConfigured = () =>
  !!(process.env.RESEND_API_KEY && process.env.ADMIN_FROM_EMAIL);

async function sendEmailCode(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn(`[otp] email not configured; code for ${to} = ${code}`);
    return false;
  }
  const text = `Your BDL sign-in code is ${code}. It expires in ${CODE_TTL_MIN} minutes.`;
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;color:#111">
    <h2 style="margin:0 0 8px;font-size:20px">Your BDL sign-in code</h2>
    <p style="font-size:32px;font-weight:800;letter-spacing:.12em;margin:12px 0">${code}</p>
    <p style="color:#666;font-size:13px">Expires in ${CODE_TTL_MIN} minutes. If you didn't request this, ignore it.</p>
  </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: "Your BDL sign-in code", text, html }),
    });
    if (!res.ok) {
      console.error("[otp] Resend rejected", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[otp] Resend send failed", e);
    return false;
  }
}

/** Begin email sign-in: email a one-time code. */
export async function requestEmailOtp(email: string): Promise<OtpRequestResult> {
  const e = (email ?? "").trim().toLowerCase();
  if (!emailValid(e)) return { ok: false, error: "Enter a valid email address." };
  const idHash = emailHash(`email:${e}`);
  const issued = await issueCode(idHash);
  if (!issued.ok) return issued;
  const delivered = await sendEmailCode(e, issued.code);
  return { ok: true, delivered: delivered && emailConfigured(), devCode: devMode() ? issued.code : undefined };
}

/** Verify the email code; find-or-create the player; start a session. */
export async function verifyEmailOtp(
  email: string,
  code: string,
  opts: { intent?: string; next?: string } = {},
): Promise<OtpVerifyResult> {
  const e = (email ?? "").trim().toLowerCase();
  if (!emailValid(e)) return { ok: false, error: "Enter a valid email address." };
  const idHash = emailHash(`email:${e}`);
  const res = await matchCode(idHash, code);
  if (!res.ok) return res;

  const eHash = emailHash(e);
  let [player] = await db
    .select({ id: players.id, firstName: players.firstName })
    .from(players)
    .where(eq(players.emailHash, eHash))
    .limit(1);
  let isNew = false;
  if (!player) {
    isNew = true;
    const [created] = await db
      .insert(players)
      .values({ firstName: "", lastName: "", email: encryptOptional(e), emailHash: eHash })
      .returning({ id: players.id, firstName: players.firstName });
    player = created;
  }

  const token = await createSession({ adminId: "", username: e, role: "player", playerId: player.id });
  await writeSessionCookie(token);
  return { ok: true, redirect: redirectFor(isNew, !!player.firstName?.trim(), opts) };
}

/* =================== PHONE OTP (secondary; needs Twilio) =================== */

function normalizePhone(raw: string): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith("1")) return d;
  return null;
}
const smsIsConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

async function sendSms(toNormalized: string, code: string): Promise<boolean> {
  if (!smsIsConfigured()) {
    console.warn(`[otp] SMS not configured; code for +${toNormalized} = ${code}`);
    return false;
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const auth = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_FROM!;
    const body = new URLSearchParams({
      To: `+${toNormalized}`,
      From: from,
      Body: `Your BDL code is ${code}. Expires in ${CODE_TTL_MIN} min.`,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      console.error("[otp] Twilio rejected", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[otp] Twilio send failed", e);
    return false;
  }
}

export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, error: "Enter a valid 10-digit US phone number." };
  const idHash = emailHash(`phone:${normalized}`);
  const issued = await issueCode(idHash);
  if (!issued.ok) return issued;
  const delivered = await sendSms(normalized, issued.code);
  return { ok: true, delivered, devCode: devMode() ? issued.code : undefined };
}

export async function verifyOtp(
  phone: string,
  code: string,
  opts: { intent?: string; next?: string } = {},
): Promise<OtpVerifyResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, error: "Enter a valid phone number." };
  const idHash = emailHash(`phone:${normalized}`);
  const res = await matchCode(idHash, code);
  if (!res.ok) return res;

  const ph = emailHash(normalized);
  let [player] = await db
    .select({ id: players.id, firstName: players.firstName })
    .from(players)
    .where(eq(players.phoneHash, ph))
    .limit(1);
  let isNew = false;
  if (!player) {
    isNew = true;
    const [created] = await db
      .insert(players)
      .values({ firstName: "", lastName: "", cell: encryptOptional(`+${normalized}`), phoneHash: ph })
      .returning({ id: players.id, firstName: players.firstName });
    player = created;
  }
  const token = await createSession({ adminId: "", username: `+${normalized}`, role: "player", playerId: player.id });
  await writeSessionCookie(token);
  return { ok: true, redirect: redirectFor(isNew, !!player.firstName?.trim(), opts) };
}
