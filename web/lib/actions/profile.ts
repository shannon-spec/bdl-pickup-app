"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, players } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Level =
  | "Not Rated"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Game Changer"
  | "Pro";

export type ProfileInput = {
  firstName: string;
  lastName: string;
  city?: string;
  state?: string;
  zip?: string;
  college?: string;
  sport?: string;
  position?: string;
  heightFt?: string;
  heightIn?: string;
  weight?: string;
  highestLevel?: string;
  level?: Level;
};

const num = (v?: string) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Self-serve update of the signed-in player's community profile. */
export async function updateMyProfile(
  input: ProfileInput,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId)
    return { ok: false, error: "Sign in to update your profile." };
  if (!input.firstName?.trim())
    return { ok: false, error: "First name is required." };

  await db
    .update(players)
    .set({
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() ?? "",
      city: input.city?.trim() || null,
      state: input.state?.trim().toUpperCase().slice(0, 2) || null,
      zip: input.zip?.trim() || null,
      college: input.college?.trim() || null,
      sport: input.sport?.trim() || null,
      position: input.position?.trim() || null,
      heightFt: num(input.heightFt),
      heightIn: num(input.heightIn),
      weight: num(input.weight),
      highestLevel: input.highestLevel?.trim() || null,
      ...(input.level ? { level: input.level } : {}),
    })
    .where(eq(players.id, session.playerId));

  revalidatePath("/discover");
  revalidatePath("/account");
  return { ok: true, data: null };
}
