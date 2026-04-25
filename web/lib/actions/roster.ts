"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, players } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { requireAdminView } from "@/lib/auth/view";

const PLAYER_LEVELS = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
] as const;
const PLAYER_STATUSES = ["Active", "Inactive", "IR"] as const;
const HIGHEST_LEVELS = ["", "Pro", "College", "High School", "N/A"] as const;

const blankOrEmail = z
  .string()
  .trim()
  .max(120)
  .optional()
  .or(z.literal(""))
  .refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Invalid email.",
  );

const playerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  email: blankOrEmail,
  cell: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z
    .string()
    .trim()
    .max(2)
    .regex(/^([A-Za-z]{2})?$/, "Two-letter state code.")
    .optional()
    .or(z.literal("")),
  zip: z
    .string()
    .trim()
    .max(10)
    .regex(/^(\d{5}(-\d{4})?)?$/, "Invalid ZIP.")
    .optional()
    .or(z.literal("")),
  position: z.string().trim().max(20).optional().or(z.literal("")),
  level: z.enum(PLAYER_LEVELS).default("Not Rated"),
  status: z.enum(PLAYER_STATUSES).default("Active"),
  birthday: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use YYYY-MM-DD.")
    .optional()
    .or(z.literal("")),
  heightFt: z.string().trim().optional().or(z.literal("")),
  heightIn: z.string().trim().optional().or(z.literal("")),
  weight: z.string().trim().optional().or(z.literal("")),
  college: z.string().trim().max(120).optional().or(z.literal("")),
  sport: z.string().trim().max(60).optional().or(z.literal("")),
  highestLevel: z.enum(HIGHEST_LEVELS).optional().or(z.literal("")),
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

function intOrNull(v: string | undefined | null): number | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function floatOrNull(v: string | undefined | null): number | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function valuesFor(v: PlayerInput) {
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    email: toNullable(v.email),
    cell: toNullable(v.cell),
    city: toNullable(v.city),
    state: toNullable(v.state)?.toUpperCase() ?? null,
    zip: toNullable(v.zip),
    position: toNullable(v.position),
    level: v.level,
    status: v.status,
    birthday: toNullable(v.birthday),
    heightFt: intOrNull(v.heightFt),
    heightIn: floatOrNull(v.heightIn),
    weight: intOrNull(v.weight),
    college: toNullable(v.college),
    sport: toNullable(v.sport),
    highestLevel: toNullable(v.highestLevel),
  };
}

export async function createPlayer(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  await requireAdminView();
  const parsed = playerSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const [row] = await db
    .insert(players)
    .values(valuesFor(parsed.data))
    .returning({ id: players.id });
  revalidatePath("/roster");
  return { ok: true, data: { id: row.id } };
}

export async function updatePlayer(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  await requireAdminView();
  const parsed = playerSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  await db.update(players).set(valuesFor(parsed.data)).where(eq(players.id, id));
  revalidatePath("/roster");
  revalidatePath(`/players/${id}`);
  revalidatePath("/");
  return { ok: true, data: { id } };
}

export async function deletePlayer(id: string): Promise<ActionResult> {
  await requireAdmin();
  await requireAdminView();
  await db.delete(players).where(eq(players.id, id));
  revalidatePath("/roster");
  revalidatePath("/");
  return { ok: true };
}
