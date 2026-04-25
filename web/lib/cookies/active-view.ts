"use server";

import { cookies } from "next/headers";

export type View = "player" | "commissioner" | "admin";

const COOKIE = "bdl_view";

export async function getActiveViewCookie(): Promise<View | null> {
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  if (v === "player" || v === "commissioner" || v === "admin") return v;
  return null;
}

export async function writeActiveViewCookie(v: View): Promise<void> {
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: v,
    httpOnly: false, // readable by client if it ever needs to (it doesn't today)
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
