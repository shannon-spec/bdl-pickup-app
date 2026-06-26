"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE = "bdl_active_context";

export type ActiveContextRef = {
  type: "LEAGUE" | "TOURNAMENT" | "TEAM" | "COMMUNITY";
  id: string;
};

/** Returns the persisted active context as `{type,id}`, or null. */
export async function getActiveContext(): Promise<ActiveContextRef | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const [type, id] = raw.split(":");
  if (!id) return null;
  if (type !== "LEAGUE" && type !== "TOURNAMENT" && type !== "TEAM" && type !== "COMMUNITY")
    return null;
  return { type, id };
}

/** Persist the active context (a returning user lands here next time). */
export async function setActiveContextAction(ref: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: ref, // "<TYPE>:<id>"
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  revalidatePath("/", "layout");
}
