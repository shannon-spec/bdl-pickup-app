"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, superAdmins } from "@/lib/db";
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

  const [admin] = await db
    .select()
    .from(superAdmins)
    .where(eq(superAdmins.username, username))
    .limit(1);

  if (!admin) return { ok: false, error: "Invalid credentials." };

  const token = await createSession({
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    playerId: admin.playerId,
  });
  await writeSessionCookie(token);
  return { ok: true };
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/login");
}
