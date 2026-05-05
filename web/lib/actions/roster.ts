"use server";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, players, leaguePlayers } from "@/lib/db";
import { readSession, requireAdmin } from "@/lib/auth/session";
import { requireAdminView } from "@/lib/auth/view";
import { canEditPlayer } from "@/lib/auth/perms";
import { encryptOptional, emailHashOptional } from "@/lib/crypto/secrets";

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
  whoopShareWithLeague: z.string().optional().or(z.literal("")),
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
  const emailPlain = toNullable(v.email);
  const cellPlain = toNullable(v.cell);
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    // PII columns are encrypted at rest; the deterministic emailHash
    // mirrors the unique constraint that used to live on email itself.
    email: encryptOptional(emailPlain),
    emailHash: emailHashOptional(emailPlain),
    cell: encryptOptional(cellPlain),
    city: toNullable(v.city),
    state: toNullable(v.state)?.toUpperCase() ?? null,
    zip: toNullable(v.zip),
    position: toNullable(v.position),
    level: v.level,
    status: v.status,
    // Birthday is not editable from the player edit form anymore — we
    // intentionally don't touch the column here, preserving any
    // existing date so the league activity feed can fire happy-birthday
    // events. Admins can still set it via direct DB / future admin UI.
    heightFt: intOrNull(v.heightFt),
    heightIn: floatOrNull(v.heightIn),
    weight: intOrNull(v.weight),
    college: toNullable(v.college),
    sport: toNullable(v.sport),
    highestLevel: toNullable(v.highestLevel),
    whoopShareWithLeague:
      v.whoopShareWithLeague === "on" ||
      v.whoopShareWithLeague === "true",
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
  const session = await readSession();
  if (!session) {
    return { ok: false, error: "Not authenticated." };
  }
  if (!(await canEditPlayer(session, id))) {
    return { ok: false, error: "You can't edit this player." };
  }
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

/**
 * Admin-only direct add from the /players directory. Creates a player
 * and optionally drops them into a league. Pass leagueId='' (or
 * omit) to leave them in the BDL Universe with no league.
 */
export async function createPlayerInDirectory(
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
  const [row] = await db
    .insert(players)
    .values(valuesFor(parsed.data))
    .returning({ id: players.id });

  const leagueId = (readForm(formData).leagueId ?? "").trim();
  if (leagueId) {
    await db
      .insert(leaguePlayers)
      .values({ leagueId, playerId: row.id })
      .onConflictDoNothing();
    revalidatePath(`/leagues/${leagueId}`);
  }

  revalidatePath("/players");
  revalidatePath("/roster");
  revalidatePath("/");
  return { ok: true, data: { id: row.id } };
}

/**
 * Player deletion is intentionally disabled.
 *
 * Hard deletes were removing historical game data, scoring history,
 * and roster relationships in ways we couldn't recover. Until a
 * comprehensive data-protection plan is in place, the public path
 * is `setPlayerHidden(id, true)` which soft-hides the row from list
 * views without dropping any history.
 *
 * Kept as a named export so any old call site still type-checks but
 * fails loudly at runtime — easier to audit than a silent removal.
 */
export async function deletePlayer(_id: string): Promise<ActionResult> {
  return {
    ok: false,
    error:
      "Player deletion is disabled. Use Hide / Unhide instead — it removes the player from list views without losing history.",
  };
}

/** Soft-hide / unhide a player. Hidden players still exist in the
 *  database (and on every game roster they were on), but list views
 *  filter them out. Admins can unhide via the same toggle. */
export async function setPlayerHidden(
  id: string,
  hidden: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  await requireAdminView();
  await db
    .update(players)
    .set({ hiddenAt: hidden ? sql`now()` : null })
    .where(eq(players.id, id));
  revalidatePath("/roster");
  revalidatePath(`/players/${id}`);
  revalidatePath("/");
  return { ok: true };
}
