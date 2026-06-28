"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  leagues,
  leagueCommissioners,
  tournaments,
  tournamentMembers,
  communities,
  communityMembers,
  divisions,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { getCreateCaps } from "@/lib/queries/organize";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type AgeBand = "youth" | "hs" | "open" | "o35" | "custom";
type SkillTier =
  | "Not Rated"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Game Changer"
  | "Pro";

export type DivisionInput = {
  name: string;
  ageBand: AgeBand;
  ageBandCustom?: string;
  skillTier?: SkillTier | null;
  cap?: number | null;
};

export type CreateEventInput = {
  type: "LEAGUE" | "TOURNAMENT" | "COMMUNITY";
  name: string;
  publish: boolean;
  visibility?: "OPEN" | "CLOSED" | "PRIVATE";
  // shared / venue
  venueName?: string;
  venueAddress?: string;
  // league
  days?: number[];
  startTime?: string;
  playStyle?: "PICKUP_AUTOBALANCE" | "FIXED_TEAMS";
  seasonLength?: number | null;
  communityId?: string | null;
  // tournament
  bracketFormat?:
    | "SINGLE_ELIM"
    | "DOUBLE_ELIM"
    | "ROUND_ROBIN"
    | "POOL_TO_BRACKET";
  teamSize?: string; // "3v3" | "5v5"
  registrationMode?: "OPEN" | "INVITE";
  entryFeeCents?: number | null;
  startDate?: string | null; // yyyy-mm-dd
  endsAt?: string | null;
  // community
  kind?: string;
  // divisions (league/tournament)
  divisions?: DivisionInput[];
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "event"}-${suffix}`;
}

async function insertDivisions(
  contextType: "LEAGUE" | "TOURNAMENT",
  contextId: string,
  rows: DivisionInput[] | undefined,
) {
  if (!rows?.length) return;
  await db.insert(divisions).values(
    rows
      .filter((d) => d.name.trim())
      .map((d, i) => ({
        contextType,
        contextId,
        name: d.name.trim(),
        ageBand: d.ageBand,
        ageBandCustom: d.ageBand === "custom" ? d.ageBandCustom?.trim() : null,
        skillTier: d.skillTier ?? null,
        cap: d.cap ?? null,
        sortOrder: i,
      })),
  );
}

/** Create a league / tournament / community, make the creator the organizer,
 *  seed divisions, and (optionally) publish. Returns the manage href. */
export async function createEvent(
  input: CreateEventInput,
): Promise<ActionResult<{ id: string; href: string }>> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in as a player to create an event." };
  }
  const me = session.playerId;
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Give it a name." };

  // Role gate: leagues → commissioners, tournaments/communities → organizers.
  const caps = await getCreateCaps(session);
  const allowed =
    input.type === "LEAGUE"
      ? caps.league
      : input.type === "TOURNAMENT"
        ? caps.tournament
        : caps.community;
  if (!allowed) {
    return {
      ok: false,
      error:
        input.type === "LEAGUE"
          ? "Only commissioners can create leagues. Ask an organizer to add you."
          : "Only organizers can create this. Ask an organizer to add you.",
    };
  }

  try {
    if (input.type === "LEAGUE") {
      const [row] = await db
        .insert(leagues)
        .values({
          name,
          playStyle: input.playStyle ?? "PICKUP_AUTOBALANCE",
          seasonLength: input.seasonLength ?? null,
          communityId: input.communityId ?? null,
          days: input.days?.length ? input.days : undefined,
          startTime: input.startTime || null,
          venueName: input.venueName || null,
          venueAddress: input.venueAddress || null,
          published: input.publish,
          visibility: input.visibility ?? "OPEN",
        })
        .returning({ id: leagues.id });
      await db
        .insert(leagueCommissioners)
        .values({ leagueId: row.id, playerId: me })
        .onConflictDoNothing();
      await insertDivisions("LEAGUE", row.id, input.divisions);
      revalidatePath("/manage");
      return { ok: true, data: { id: row.id, href: `/manage/league/${row.id}` } };
    }

    if (input.type === "TOURNAMENT") {
      const [row] = await db
        .insert(tournaments)
        .values({
          name,
          slug: slugify(name),
          communityId: input.communityId ?? null,
          format: input.teamSize === "3v3" ? "3v3" : "5v5",
          teamSize: input.teamSize || "5v5",
          bracketFormat: input.bracketFormat ?? "SINGLE_ELIM",
          registrationMode: input.registrationMode ?? "OPEN",
          entryFeeCents: input.entryFeeCents ?? null,
          startDate: input.startDate || null,
          endsAt: input.endsAt || null,
          published: input.publish,
          visibility: input.visibility ?? "OPEN",
          createdBy: me,
        })
        .returning({ id: tournaments.id });
      await db
        .insert(tournamentMembers)
        .values({
          tournamentId: row.id,
          playerId: me,
          role: "DIRECTOR",
          status: "active",
        })
        .onConflictDoNothing();
      await insertDivisions("TOURNAMENT", row.id, input.divisions);
      revalidatePath("/manage");
      return {
        ok: true,
        data: { id: row.id, href: `/manage/tournament/${row.id}` },
      };
    }

    // COMMUNITY
    const [row] = await db
      .insert(communities)
      .values({
        name,
        slug: slugify(name),
        kind: input.kind || "other",
        visibility: input.visibility ?? "OPEN",
        createdBy: me,
      })
      .returning({ id: communities.id });
    await db
      .insert(communityMembers)
      .values({
        communityId: row.id,
        playerId: me,
        role: "DIRECTOR",
        status: "active",
      })
      .onConflictDoNothing();
    revalidatePath("/manage");
    return {
      ok: true,
      data: { id: row.id, href: `/manage/community/${row.id}` },
    };
  } catch (e) {
    console.error("[createEvent]", e);
    return { ok: false, error: "Couldn't create it. Try again." };
  }
}

/** Admin-only: remove an event (soft-hide — reversible, keeps data). */
export async function deleteEvent(
  type: "LEAGUE" | "TOURNAMENT" | "COMMUNITY",
  id: string,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!isAdminLike(session))
    return { ok: false, error: "Only admins can delete events." };
  const now = new Date();
  if (type === "LEAGUE")
    await db.update(leagues).set({ hiddenAt: now }).where(eq(leagues.id, id));
  else if (type === "TOURNAMENT")
    await db.update(tournaments).set({ hiddenAt: now }).where(eq(tournaments.id, id));
  else await db.update(communities).set({ hiddenAt: now }).where(eq(communities.id, id));
  revalidatePath("/manage");
  return { ok: true, data: null };
}
