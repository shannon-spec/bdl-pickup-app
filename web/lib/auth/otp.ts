"use server";

import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db, players, authOtp } from "@/lib/db";
import { emailHash, encryptOptional } from "@/lib/crypto/secrets";
import { createSession, writeSessionCookie } from "./session";

const CODE_TTL_MIN = 10;
const MAX_SENDS_PER_WINDOW = 5; // per phone, per window
const SEND_WINDOW_MIN = 15;
const MAX_VERIFY_ATTEMPTS = 5;

export type OtpRequestResult =
  | { ok: true; smsConfigured: boolean; devCode?: string }
  | { ok: false; error: string };

export type OtpVerifyResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

/** Normalize a US phone to 11 digits ("1XXXXXXXXXX"); null if not valid. */
function normalizePhone(raw: string): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith("1")) return d;
  return null;
}

const phoneHashOf = (normalized: string) => emailHash(normalized);

const smsIsConfigured = () =>
  !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );

const devMode = () =>
  process.env.NODE_ENV !== "production" || process.env.OTP_DEV_MODE === "1";

async function sendSms(toNormalized: string, code: string): Promise<void> {
  if (!smsIsConfigured()) {
    console.warn(`[otp] SMS not configured; code for +${toNormalized} = ${code}`);
    return;
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
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    if (!res.ok) console.error("[otp] Twilio rejected", res.status, await res.text());
  } catch (e) {
    console.error("[otp] Twilio send failed", e);
  }
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || "unknown";
}

/** Begin OTP sign-in: generate + store a hashed code, send it (or log it). */
export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { ok: false, error: "Enter a valid 10-digit US phone number." };
  }
  const ph = phoneHashOf(normalized);

  // Rate-limit: cap sends per phone within the window.
  const since = new Date(Date.now() - SEND_WINDOW_MIN * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authOtp)
    .where(and(eq(authOtp.phoneHash, ph), gt(authOtp.createdAt, since)));
  if (count >= MAX_SENDS_PER_WINDOW) {
    return {
      ok: false,
      error: "Too many codes requested. Wait a few minutes and try again.",
    };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);
  await db.insert(authOtp).values({
    phoneHash: ph,
    codeHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000),
    requestIp: await clientIp(),
  });

  await sendSms(normalized, code);

  return {
    ok: true,
    smsConfigured: smsIsConfigured(),
    devCode: devMode() ? code : undefined,
  };
}

/** Verify the latest live code; find-or-create the player; start a session. */
export async function verifyOtp(
  phone: string,
  code: string,
  opts: { intent?: string; next?: string } = {},
): Promise<OtpVerifyResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, error: "Enter a valid phone number." };
  const ph = phoneHashOf(normalized);

  const [row] = await db
    .select()
    .from(authOtp)
    .where(and(eq(authOtp.phoneHash, ph), isNull(authOtp.consumedAt)))
    .orderBy(desc(authOtp.createdAt))
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Code expired — request a new one." };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many tries. Request a new code." };
  }

  const cleanCode = (code ?? "").replace(/\D/g, "");
  const matches = await bcrypt.compare(cleanCode, row.codeHash);
  if (!matches) {
    await db
      .update(authOtp)
      .set({ attempts: row.attempts + 1 })
      .where(eq(authOtp.id, row.id));
    return { ok: false, error: "That code isn't right. Try again." };
  }

  await db
    .update(authOtp)
    .set({ consumedAt: new Date() })
    .where(eq(authOtp.id, row.id));

  // Find-or-create the player by phone hash.
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
      .values({
        firstName: "",
        lastName: "",
        cell: encryptOptional(`+${normalized}`),
        phoneHash: ph,
      })
      .returning({ id: players.id, firstName: players.firstName });
    player = created;
  }

  const token = await createSession({
    adminId: "",
    username: `+${normalized}`,
    role: "player",
    playerId: player.id,
  });
  await writeSessionCookie(token);

  // New accounts (or no name yet) go to the persona fork; returning users
  // go to next= or their role home.
  const needsWelcome = isNew || !player.firstName?.trim();
  const intentQs = opts.intent ? `?intent=${encodeURIComponent(opts.intent)}` : "";
  const redirect = needsWelcome
    ? `/welcome${intentQs}`
    : opts.next && opts.next.startsWith("/")
      ? opts.next
      : "/home";
  return { ok: true, redirect };
}
