"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  tournaments,
  tournamentMembers,
  divisions,
  registrations,
  matches,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function canManage(tournamentId: string): Promise<boolean> {
  const session = await readSession();
  if (isAdminLike(session)) return true;
  if (!session?.playerId) return false;
  const [row] = await db
    .select({ role: tournamentMembers.role })
    .from(tournamentMembers)
    .where(
      and(
        eq(tournamentMembers.tournamentId, tournamentId),
        eq(tournamentMembers.playerId, session.playerId),
      ),
    )
    .limit(1);
  return row?.role === "DIRECTOR" || row?.role === "COMMISSIONER";
}

/** Confirm the division belongs to the tournament (cheap ownership guard). */
async function divisionInTournament(
  divisionId: string,
  tournamentId: string,
): Promise<boolean> {
  const [d] = await db
    .select({ contextId: divisions.contextId, contextType: divisions.contextType })
    .from(divisions)
    .where(eq(divisions.id, divisionId))
    .limit(1);
  return !!d && d.contextType === "TOURNAMENT" && d.contextId === tournamentId;
}

function revalidate(tournamentId: string) {
  revalidatePath(`/manage/tournament/${tournamentId}`);
}

/* ---------- registrations ---------- */

export async function addRegistration(
  tournamentId: string,
  divisionId: string,
  teamName: string,
): Promise<ActionResult<{ id: string }>> {
  if (!(await canManage(tournamentId)))
    return { ok: false, error: "Not allowed." };
  if (!(await divisionInTournament(divisionId, tournamentId)))
    return { ok: false, error: "Bad division." };
  const name = teamName.trim();
  if (!name) return { ok: false, error: "Enter a team name." };

  const existing = await db
    .select({ seed: registrations.seed })
    .from(registrations)
    .where(eq(registrations.divisionId, divisionId));
  const nextSeed =
    existing.reduce((m, r) => Math.max(m, r.seed ?? 0), 0) + 1;

  const session = await readSession();
  const [row] = await db
    .insert(registrations)
    .values({
      divisionId,
      teamName: name,
      status: "confirmed",
      seed: nextSeed,
      createdBy: session?.playerId ?? null,
    })
    .returning({ id: registrations.id });
  revalidate(tournamentId);
  return { ok: true, data: { id: row.id } };
}

export async function removeRegistration(
  tournamentId: string,
  registrationId: string,
): Promise<ActionResult<null>> {
  if (!(await canManage(tournamentId)))
    return { ok: false, error: "Not allowed." };
  await db.delete(registrations).where(eq(registrations.id, registrationId));
  revalidate(tournamentId);
  return { ok: true, data: null };
}

export async function updateRegistration(
  tournamentId: string,
  registrationId: string,
  patch: { seed?: number | null; status?: "pending" | "confirmed" | "waitlist"; paid?: boolean },
): Promise<ActionResult<null>> {
  if (!(await canManage(tournamentId)))
    return { ok: false, error: "Not allowed." };
  await db
    .update(registrations)
    .set({
      ...(patch.seed !== undefined ? { seed: patch.seed } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.paid !== undefined ? { paid: patch.paid } : {}),
    })
    .where(eq(registrations.id, registrationId));
  revalidate(tournamentId);
  return { ok: true, data: null };
}

/* ---------- bracket generation (single elim) ---------- */

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Round-robin pairings via the circle method (handles odd counts w/ a bye). */
function roundRobinPairs(
  ids: string[],
): { round: number; home: string; away: string }[] {
  const arr: (string | null)[] = ids.slice();
  if (arr.length % 2 === 1) arr.push(null); // bye
  const n = arr.length;
  const half = n / 2;
  const out: { round: number; home: string; away: string }[] = [];
  let order = arr.slice();
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < half; i++) {
      const home = order[i];
      const away = order[n - 1 - i];
      // alternate home/away each round for fairness
      if (home !== null && away !== null) {
        if (r % 2 === 0) out.push({ round: r + 1, home, away });
        else out.push({ round: r + 1, home: away, away: home });
      }
    }
    const fixed = order[0];
    const rest = order.slice(1);
    rest.unshift(rest.pop() as string | null);
    order = [fixed, ...rest];
  }
  return out;
}

/** Standard bracket seed order for a given size (power of 2). */
function seedOrder(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

export async function generateBracket(
  tournamentId: string,
  divisionId: string,
): Promise<ActionResult<{ matches: number }>> {
  if (!(await canManage(tournamentId)))
    return { ok: false, error: "Not allowed." };
  if (!(await divisionInTournament(divisionId, tournamentId)))
    return { ok: false, error: "Bad division." };

  const regs = await db
    .select({ id: registrations.id, seed: registrations.seed })
    .from(registrations)
    .where(
      and(
        eq(registrations.divisionId, divisionId),
        eq(registrations.status, "confirmed"),
      ),
    );
  const ordered = regs.sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999));
  const n = ordered.length;
  if (n < 2)
    return { ok: false, error: "Add at least 2 confirmed teams first." };

  const [tour] = await db
    .select({ fmt: tournaments.bracketFormat })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  // ---- Round robin: everyone plays everyone, standings decide it ----
  if ((tour?.fmt ?? "SINGLE_ELIM") === "ROUND_ROBIN") {
    await db.delete(matches).where(eq(matches.divisionId, divisionId));
    const pairs = roundRobinPairs(ordered.map((r) => r.id));
    const slotByRound: Record<number, number> = {};
    const rows = pairs.map((p) => {
      const slot = slotByRound[p.round] ?? 0;
      slotByRound[p.round] = slot + 1;
      return {
        divisionId,
        round: p.round,
        slot,
        homeRegistrationId: p.home,
        awayRegistrationId: p.away,
      };
    });
    await db.insert(matches).values(rows);
    revalidate(tournamentId);
    return { ok: true, data: { matches: rows.length } };
  }

  // ---- Single / double elim / pools → single-elim bracket ----
  // seedNo (1..n) -> registration id
  const seedToReg = new Map<number, string>();
  ordered.forEach((r, i) => seedToReg.set(i + 1, r.id));

  const size = nextPow2(n);
  const rounds = Math.log2(size);
  const order = seedOrder(size);

  // wipe any existing bracket for this division, then rebuild
  await db.delete(matches).where(eq(matches.divisionId, divisionId));

  const insertedByRound: Record<number, { id: string; slot: number; winnerRegistrationId: string | null; nextMatchId: string | null; nextSlotIsHome: boolean | null }[]> = {};

  for (let r = rounds; r >= 1; r--) {
    const count = size / 2 ** r;
    const rows = [];
    for (let slot = 0; slot < count; slot++) {
      let nextMatchId: string | null = null;
      let nextSlotIsHome: boolean | null = null;
      if (r < rounds) {
        const parent = insertedByRound[r + 1][Math.floor(slot / 2)];
        nextMatchId = parent.id;
        nextSlotIsHome = slot % 2 === 0;
      }
      let homeRegistrationId: string | null = null;
      let awayRegistrationId: string | null = null;
      let winnerRegistrationId: string | null = null;
      if (r === 1) {
        homeRegistrationId = seedToReg.get(order[slot * 2]) ?? null;
        awayRegistrationId = seedToReg.get(order[slot * 2 + 1]) ?? null;
        if (homeRegistrationId && !awayRegistrationId)
          winnerRegistrationId = homeRegistrationId; // bye
        else if (awayRegistrationId && !homeRegistrationId)
          winnerRegistrationId = awayRegistrationId; // bye
      }
      rows.push({
        divisionId,
        round: r,
        slot,
        homeRegistrationId,
        awayRegistrationId,
        winnerRegistrationId,
        nextMatchId,
        nextSlotIsHome,
      });
    }
    const inserted = await db
      .insert(matches)
      .values(rows)
      .returning({
        id: matches.id,
        slot: matches.slot,
        winnerRegistrationId: matches.winnerRegistrationId,
        nextMatchId: matches.nextMatchId,
        nextSlotIsHome: matches.nextSlotIsHome,
      });
    inserted.sort((a, b) => a.slot - b.slot);
    insertedByRound[r] = inserted;
  }

  // advance round-1 byes into round 2
  if (rounds > 1) {
    for (const m of insertedByRound[1]) {
      if (m.winnerRegistrationId && m.nextMatchId) {
        await db
          .update(matches)
          .set(
            m.nextSlotIsHome
              ? { homeRegistrationId: m.winnerRegistrationId }
              : { awayRegistrationId: m.winnerRegistrationId },
          )
          .where(eq(matches.id, m.nextMatchId));
      }
    }
  }

  revalidate(tournamentId);
  return { ok: true, data: { matches: size - 1 } };
}

/** Enter/replace a score; winner auto-advances to the next match slot. */
export async function enterMatchScore(
  tournamentId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<ActionResult<{ winnerRegistrationId: string | null }>> {
  if (!(await canManage(tournamentId)))
    return { ok: false, error: "Not allowed." };

  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) return { ok: false, error: "Match not found." };
  if (!(await divisionInTournament(m.divisionId, tournamentId)))
    return { ok: false, error: "Bad match." };
  if (!m.homeRegistrationId || !m.awayRegistrationId)
    return { ok: false, error: "Both teams must be set first." };
  if (homeScore === awayScore)
    return { ok: false, error: "No ties — one team must win." };

  const winner =
    homeScore > awayScore ? m.homeRegistrationId : m.awayRegistrationId;

  await db
    .update(matches)
    .set({ homeScore, awayScore, winnerRegistrationId: winner })
    .where(eq(matches.id, matchId));

  // advance winner into the next match
  if (m.nextMatchId) {
    await db
      .update(matches)
      .set(
        m.nextSlotIsHome
          ? { homeRegistrationId: winner }
          : { awayRegistrationId: winner },
      )
      .where(eq(matches.id, m.nextMatchId));
  }

  revalidate(tournamentId);
  return { ok: true, data: { winnerRegistrationId: winner } };
}

/** Crowned champion = winner of the final (no next match). */
export async function getChampion(
  divisionId: string,
): Promise<string | null> {
  const finals = await db
    .select({ winner: matches.winnerRegistrationId, next: matches.nextMatchId })
    .from(matches)
    .where(eq(matches.divisionId, divisionId))
    .orderBy(asc(matches.round));
  const final = finals.find((f) => f.next === null);
  return final?.winner ?? null;
}
