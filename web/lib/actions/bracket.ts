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

  // ---- Double elimination (winners + losers bracket + grand final) ----
  if ((tour?.fmt ?? "SINGLE_ELIM") === "DOUBLE_ELIM") {
    if (n < 4 || (n & (n - 1)) !== 0) {
      return {
        ok: false,
        error:
          "Double-elim needs a power-of-two field (4, 8, 16…). Add or drop teams to match.",
      };
    }
    return generateDoubleElim(tournamentId, divisionId, ordered);
  }

  // ---- Single elim / pools → single-elim bracket ----
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

/** Build a full double-elimination bracket for a power-of-two field. */
async function generateDoubleElim(
  tournamentId: string,
  divisionId: string,
  ordered: { id: string; seed: number | null }[],
): Promise<ActionResult<{ matches: number }>> {
  const size = ordered.length;
  const k = Math.log2(size);
  const order = seedOrder(size);
  const seedToReg = new Map<number, string>();
  ordered.forEach((r, i) => seedToReg.set(i + 1, r.id));

  await db.delete(matches).where(eq(matches.divisionId, divisionId));

  type Desc = {
    group: "W" | "L" | "GF";
    round: number;
    slot: number;
    home: string | null;
    away: string | null;
  };
  const descs: Desc[] = [];

  // winners bracket
  for (let r = 1; r <= k; r++) {
    const count = size / 2 ** r;
    for (let s = 0; s < count; s++) {
      const home = r === 1 ? (seedToReg.get(order[2 * s]) ?? null) : null;
      const away = r === 1 ? (seedToReg.get(order[2 * s + 1]) ?? null) : null;
      descs.push({ group: "W", round: r, slot: s, home, away });
    }
  }
  // losers bracket — 2(k-1) rounds, alternating minor / major
  const lbRounds = 2 * (k - 1);
  for (let lr = 1; lr <= lbRounds; lr++) {
    const j = Math.ceil(lr / 2);
    const count = size / 2 ** (j + 1);
    for (let s = 0; s < count; s++)
      descs.push({ group: "L", round: lr, slot: s, home: null, away: null });
  }
  // grand final
  descs.push({ group: "GF", round: 1, slot: 0, home: null, away: null });

  const inserted = await db
    .insert(matches)
    .values(
      descs.map((d) => ({
        divisionId,
        round: d.round,
        slot: d.slot,
        bracketGroup: d.group,
        homeRegistrationId: d.home,
        awayRegistrationId: d.away,
      })),
    )
    .returning({
      id: matches.id,
      round: matches.round,
      slot: matches.slot,
      bracketGroup: matches.bracketGroup,
    });

  const idOf = (g: string, r: number, s: number) =>
    inserted.find((m) => m.bracketGroup === g && m.round === r && m.slot === s)!
      .id;

  const setNext = (from: string, to: string, isHome: boolean) =>
    db
      .update(matches)
      .set({ nextMatchId: to, nextSlotIsHome: isHome })
      .where(eq(matches.id, from));
  const setLoser = (from: string, to: string, isHome: boolean) =>
    db
      .update(matches)
      .set({ loserNextMatchId: to, loserNextSlotIsHome: isHome })
      .where(eq(matches.id, from));

  // winners-bracket links: winner advances in WB (→ GF at the end), loser drops to LB
  for (let r = 1; r <= k; r++) {
    const count = size / 2 ** r;
    for (let m = 0; m < count; m++) {
      const from = idOf("W", r, m);
      if (r < k) await setNext(from, idOf("W", r + 1, Math.floor(m / 2)), m % 2 === 0);
      else await setNext(from, idOf("GF", 1, 0), true);
      if (r === 1) await setLoser(from, idOf("L", 1, Math.floor(m / 2)), m % 2 === 0);
      else await setLoser(from, idOf("L", 2 * (r - 1), m), false);
    }
  }
  // losers-bracket links
  for (let lr = 1; lr <= lbRounds; lr++) {
    const j = Math.ceil(lr / 2);
    const count = size / 2 ** (j + 1);
    const minor = lr % 2 === 1;
    for (let m = 0; m < count; m++) {
      const from = idOf("L", lr, m);
      if (minor) await setNext(from, idOf("L", lr + 1, m), true);
      else if (lr < lbRounds)
        await setNext(from, idOf("L", lr + 1, Math.floor(m / 2)), m % 2 === 0);
      else await setNext(from, idOf("GF", 1, 0), false);
    }
  }

  revalidate(tournamentId);
  return { ok: true, data: { matches: descs.length } };
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

  // double-elim: drop the loser into the losers bracket
  if (m.loserNextMatchId) {
    const loser =
      winner === m.homeRegistrationId
        ? m.awayRegistrationId
        : m.homeRegistrationId;
    await db
      .update(matches)
      .set(
        m.loserNextSlotIsHome
          ? { homeRegistrationId: loser }
          : { awayRegistrationId: loser },
      )
      .where(eq(matches.id, m.loserNextMatchId));
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
