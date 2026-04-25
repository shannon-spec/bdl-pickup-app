"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE = "bdl_active_league";

export async function getActiveLeagueId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setActiveLeagueAction(leagueId: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: leagueId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  // Refresh anything that derives from the active league.
  revalidatePath("/", "layout");
}
