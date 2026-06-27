"use server";

import { cookies } from "next/headers";

/**
 * Remembers the last identifier used to sign in *on this device* so the login
 * screen can greet a returning user and pre-fill their email/phone. This is a
 * convenience only — a one-time code is still always required. Survives sign
 * out (that only clears the session), so the device stays "recognized".
 */
const COOKIE = "bdl_last_login";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export type RememberedLogin = { kind: "email" | "phone"; value: string };

export async function getRememberedLogin(): Promise<RememberedLogin | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const i = raw.indexOf(":");
  if (i < 0) return null;
  const kind = raw.slice(0, i);
  const value = raw.slice(i + 1);
  if ((kind !== "email" && kind !== "phone") || !value) return null;
  return { kind, value };
}

export async function setRememberedLogin(
  kind: "email" | "phone",
  value: string,
): Promise<void> {
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: `${kind}:${value}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearRememberedLogin(): Promise<void> {
  const store = await cookies();
  store.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
}
