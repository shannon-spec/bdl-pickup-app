"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, players } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";

const PLAYER_LEVELS = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
] as const;
const PLAYER_STATUSES = ["Active", "Inactive", "IR"] as const;

const playerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  email: z
    .string()
    .trim()
    .max(120)
    .email("Invalid email.")
    .optional()
    .or(z.literal("")),
  cell: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z
    .string()
    .trim()
    .max(2)
    .regex(/^[A-Za-z]{2}$/, "Two-letter state code.")
    .optional()
    .or(z.literal("")),
  position: z.string().trim().max(20).optional().or(z.literal("")),
  level: z.enum(PLAYER_LEVELS).default("Not Rated"),
  status: z.enum(PLAYER_STATUSES).default("Active"),
});

export type PlayerInput = z.infer<typeof playerSchema>;

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function readForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function toNullable(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function createPlayer(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = playerSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const [row] = await db
    .insert(players)
    .values({
      firstName: v.firstName,
      lastName: v.lastName,
      email: toNullable(v.email),
      cell: toNullable(v.cell),
      city: toNullable(v.city),
      state: toNullable(v.state)?.toUpperCase() ?? null,
      position: toNullable(v.position),
      level: v.level,
      status: v.status,
    })
    .returning({ id: players.id });
  revalidatePath("/roster");
  return { ok: true, data: { id: row.id } };
}

export async function updatePlayer(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = playerSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  await db
    .update(players)
    .set({
      firstName: v.firstName,
      lastName: v.lastName,
      email: toNullable(v.email),
      cell: toNullable(v.cell),
      city: toNullable(v.city),
      state: toNullable(v.state)?.toUpperCase() ?? null,
      position: toNullable(v.position),
      level: v.level,
      status: v.status,
    })
    .where(eq(players.id, id));
  revalidatePath("/roster");
  revalidatePath("/");
  return { ok: true, data: { id } };
}

export async function deletePlayer(id: string): Promise<ActionResult> {
  await requireAdmin();
  await db.delete(players).where(eq(players.id, id));
  revalidatePath("/roster");
  revalidatePath("/");
  return { ok: true };
}
