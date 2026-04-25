"use server";

import { eq } from "drizzle-orm";
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

export async function signInAdmin(formData: FormData): Promise<SignInResult> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { ok: false, error: "Username and password are required." };
  }

  // Try super_admins first — shared-password gate stays in place for them.
  const [admin] = await db
    .select()
    .from(superAdmins)
    .where(eq(superAdmins.username, username))
    .limit(1);

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
  const [player] = await db
    .select({
      id: players.id,
      username: players.username,
      passwordHash: players.passwordHash,
    })
    .from(players)
    .where(eq(players.username, username))
    .limit(1);

  if (!player || !player.passwordHash) {
    return { ok: false, error: "Invalid credentials." };
  }
  const ok = await bcrypt.compare(password, player.passwordHash);
  if (!ok) return { ok: false, error: "Invalid credentials." };

  const token = await createSession({
    adminId: "",
    username: player.username ?? username,
    role: "player",
    playerId: player.id,
  });
  await writeSessionCookie(token);
  return { ok: true };
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/login");
}
