"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, superAdmins, players } from "@/lib/db";
import {
  createSession,
  writeSessionCookie,
  clearSessionCookie,
} from "./session";

/**
 * Constant-time string compare to avoid password-shape timing leaks.
 */
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still scan the shorter buffer to keep timing more consistent.
    let diff = 1;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
    return false && diff === 0; // guaranteed false
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SignInResult = { ok: true } | { ok: false; error: string };

const looksLikeEmail = (s: string) => s.includes("@");

export async function signInAdmin(formData: FormData): Promise<SignInResult> {
  // The form field is still named "username" but accepts either a
  // username OR an email — whichever the user remembers. Heuristic:
  // anything containing "@" is treated as an email.
  const identifier = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) {
    return { ok: false, error: "Username/email and password are required." };
  }
  const isEmail = looksLikeEmail(identifier);

  // Look up super_admins by either username or email. `players.email`
  // and `super_admins.email` aren't unique columns, so an email match
  // could in theory return multiple rows. We refuse ambiguous matches
  // outright — same generic error so we don't leak which side failed.
  const adminMatches = await db
    .select()
    .from(superAdmins)
    .where(
      isEmail
        ? sql`lower(${superAdmins.email}) = ${identifier}`
        : eq(superAdmins.username, identifier),
    )
    .limit(2);
  if (adminMatches.length > 1) {
    return { ok: false, error: "Invalid credentials." };
  }
  const admin = adminMatches[0];

  if (admin) {
    const expected = process.env.ADMIN_SHARED_PASSWORD;
    if (!expected) {
      return {
        ok: false,
        error: "Server not configured (ADMIN_SHARED_PASSWORD missing).",
      };
    }
    if (!safeEq(password, expected)) {
      return { ok: false, error: "Invalid credentials." };
    }
    const token = await createSession({
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      playerId: admin.playerId,
    });
    await writeSessionCookie(token);
    return { ok: true };
  }

  // Fall back to player credentials. Players store a per-account bcrypt
  // hash; no shared password.
  const playerMatches = await db
    .select({
      id: players.id,
      username: players.username,
      passwordHash: players.passwordHash,
    })
    .from(players)
    .where(
      isEmail
        ? sql`lower(${players.email}) = ${identifier}`
        : eq(players.username, identifier),
    )
    .limit(2);
  if (playerMatches.length > 1) {
    // Ambiguous — multiple players with the same email. Refuse and
    // keep the error generic. The phase-2 unique-email constraint
    // makes this branch unreachable.
    return { ok: false, error: "Invalid credentials." };
  }
  const player = playerMatches[0];

  if (!player || !player.passwordHash) {
    return { ok: false, error: "Invalid credentials." };
  }
  const ok = await bcrypt.compare(password, player.passwordHash);
  if (!ok) return { ok: false, error: "Invalid credentials." };

  const token = await createSession({
    adminId: "",
    username: player.username ?? identifier,
    role: "player",
    playerId: player.id,
  });
  await writeSessionCookie(token);
  return { ok: true };
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/discover");
}
