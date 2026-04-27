/**
 * Player grading aggregate.
 *
 * Each voter casts at most one grade per target player. The voter's
 * bucket (peer vs commissioner) is derived at read time from the set
 * of leagues they share with the target — if the voter commissions
 * any league the target is in, their vote counts toward the
 * commissioner side. Otherwise it counts as a peer vote.
 *
 * Final score:
 *   peerAvg = mean of peer-vote numeric grades
 *   commAvg = mean of commissioner-vote numeric grades
 *   final   = 0.5 * peerAvg + 0.5 * commAvg  (when both exist)
 *           = whichever side voted             (when only one exists)
 *
 * Averaging the commissioner side IS the dilution: 3 commissioners
 * voting Pro/Advanced/Game Changer each contribute 1/3 of the
 * commissioner half, not three full votes.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  playerGrades,
  leaguePlayers,
  leagueCommissioners,
} from "@/lib/db";
import type { Session } from "@/lib/auth/session";

export type GradeKey =
  | "Not Rated"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Game Changer"
  | "Pro";

const VOTABLE_GRADES: GradeKey[] = [
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
];

export const isVotableGrade = (g: string): g is GradeKey =>
  (VOTABLE_GRADES as string[]).includes(g);

const GRADE_VALUE: Record<GradeKey, number | null> = {
  "Not Rated": null,
  Novice: 1,
  Intermediate: 2,
  Advanced: 3,
  "Game Changer": 4,
  Pro: 5,
};

const valueToGrade = (v: number): GradeKey => {
  if (v < 1.5) return "Novice";
  if (v < 2.5) return "Intermediate";
  if (v < 3.5) return "Advanced";
  if (v < 4.5) return "Game Changer";
  return "Pro";
};

export type PlayerGradeAggregate = {
  /**
   * Crowd-derived grade. Null when no votes (or only "Not Rated"
   * placeholders, which can't actually be cast).
   */
  crowdGrade: GradeKey | null;
  /** Numeric blend in 1..5; null when no votes. */
  crowdScore: number | null;
  peerCount: number;
  commissionerCount: number;
  /** The viewer's own vote on this target, if any. */
  myVote: GradeKey | null;
  /**
   * True when the viewer is signed in, has a player record, shares
   * at least one league with the target, and isn't the target. The
   * UI uses this to decide whether to show the voting widget.
   */
  canVote: boolean;
};

export async function getPlayerGradeAggregate(
  targetId: string,
  session: Session | null,
): Promise<PlayerGradeAggregate> {
  // Pull all votes on this target plus the leagues the target is in.
  // We fan out from there to figure out who's a commissioner of one
  // of those leagues at read time.
  const [allVotes, targetLeagueRows] = await Promise.all([
    db
      .select({
        voterId: playerGrades.voterPlayerId,
        grade: playerGrades.grade,
      })
      .from(playerGrades)
      .where(eq(playerGrades.targetPlayerId, targetId)),
    db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(eq(leaguePlayers.playerId, targetId)),
  ]);

  const targetLeagueIds = targetLeagueRows.map((r) => r.leagueId);

  // Voters who commission any of the target's leagues. Single
  // round-trip; empty set when target isn't in any leagues yet.
  const commissionerVoterIds = new Set<string>();
  if (targetLeagueIds.length > 0 && allVotes.length > 0) {
    const voterIds = allVotes.map((v) => v.voterId);
    const commRows = await db
      .select({ playerId: leagueCommissioners.playerId })
      .from(leagueCommissioners)
      .where(
        and(
          inArray(leagueCommissioners.leagueId, targetLeagueIds),
          inArray(leagueCommissioners.playerId, voterIds),
        ),
      );
    for (const r of commRows) commissionerVoterIds.add(r.playerId);
  }

  let peerSum = 0;
  let peerCount = 0;
  let commSum = 0;
  let commCount = 0;
  let myVote: GradeKey | null = null;
  for (const v of allVotes) {
    const num = GRADE_VALUE[v.grade as GradeKey];
    if (num === null) continue;
    if (commissionerVoterIds.has(v.voterId)) {
      commSum += num;
      commCount++;
    } else {
      peerSum += num;
      peerCount++;
    }
    if (session?.playerId && v.voterId === session.playerId) {
      myVote = v.grade as GradeKey;
    }
  }

  const peerAvg = peerCount > 0 ? peerSum / peerCount : null;
  const commAvg = commCount > 0 ? commSum / commCount : null;
  let crowdScore: number | null = null;
  if (peerAvg !== null && commAvg !== null) {
    crowdScore = 0.5 * peerAvg + 0.5 * commAvg;
  } else if (peerAvg !== null) {
    crowdScore = peerAvg;
  } else if (commAvg !== null) {
    crowdScore = commAvg;
  }
  const crowdGrade = crowdScore !== null ? valueToGrade(crowdScore) : null;

  // Eligibility: voter must have a player record and share a league
  // with the target. Self-voting is allowed.
  let canVote = false;
  if (session?.playerId && targetLeagueIds.length > 0) {
    if (session.playerId === targetId) {
      canVote = true;
    } else {
      const [overlap] = await db
        .select({ leagueId: leaguePlayers.leagueId })
        .from(leaguePlayers)
        .where(
          and(
            eq(leaguePlayers.playerId, session.playerId),
            inArray(leaguePlayers.leagueId, targetLeagueIds),
          ),
        )
        .limit(1);
      canVote = !!overlap;
    }
  }

  return {
    crowdGrade,
    crowdScore,
    peerCount,
    commissionerCount: commCount,
    myVote,
    canVote,
  };
}

/**
 * Bulk variant for the players directory: returns a Map<targetId,
 * crowdGrade> populated only for targets with at least one vote.
 * Skips the eligibility / myVote computation since the directory
 * cards don't surface them.
 */
export async function getCrowdGradesForPlayers(
  targetIds: string[],
): Promise<Map<string, GradeKey>> {
  const out = new Map<string, GradeKey>();
  if (targetIds.length === 0) return out;

  const [votes, allLeagueRows] = await Promise.all([
    db
      .select({
        targetId: playerGrades.targetPlayerId,
        voterId: playerGrades.voterPlayerId,
        grade: playerGrades.grade,
      })
      .from(playerGrades)
      .where(inArray(playerGrades.targetPlayerId, targetIds)),
    db
      .select({
        playerId: leaguePlayers.playerId,
        leagueId: leaguePlayers.leagueId,
      })
      .from(leaguePlayers)
      .where(inArray(leaguePlayers.playerId, targetIds)),
  ]);

  if (votes.length === 0) return out;

  // target → set of league IDs
  const targetLeagues = new Map<string, Set<string>>();
  for (const r of allLeagueRows) {
    const s = targetLeagues.get(r.playerId) ?? new Set<string>();
    s.add(r.leagueId);
    targetLeagues.set(r.playerId, s);
  }

  // All commissioner rows for any of the involved leagues.
  const allLeagueIds = Array.from(
    new Set(allLeagueRows.map((r) => r.leagueId)),
  );
  const commRows =
    allLeagueIds.length > 0
      ? await db
          .select({
            leagueId: leagueCommissioners.leagueId,
            playerId: leagueCommissioners.playerId,
          })
          .from(leagueCommissioners)
          .where(inArray(leagueCommissioners.leagueId, allLeagueIds))
      : [];
  // league → set of commissioner player IDs
  const leagueComms = new Map<string, Set<string>>();
  for (const r of commRows) {
    const s = leagueComms.get(r.leagueId) ?? new Set<string>();
    s.add(r.playerId);
    leagueComms.set(r.leagueId, s);
  }

  // Per-target accumulator.
  type Acc = { peerSum: number; peerCount: number; commSum: number; commCount: number };
  const buckets = new Map<string, Acc>();
  for (const v of votes) {
    const num = GRADE_VALUE[v.grade as GradeKey];
    if (num === null) continue;
    const targetLeagueSet = targetLeagues.get(v.targetId);
    let isCommish = false;
    if (targetLeagueSet) {
      for (const lid of targetLeagueSet) {
        if (leagueComms.get(lid)?.has(v.voterId)) {
          isCommish = true;
          break;
        }
      }
    }
    const acc =
      buckets.get(v.targetId) ?? {
        peerSum: 0,
        peerCount: 0,
        commSum: 0,
        commCount: 0,
      };
    if (isCommish) {
      acc.commSum += num;
      acc.commCount++;
    } else {
      acc.peerSum += num;
      acc.peerCount++;
    }
    buckets.set(v.targetId, acc);
  }

  for (const [targetId, acc] of buckets) {
    const peerAvg = acc.peerCount > 0 ? acc.peerSum / acc.peerCount : null;
    const commAvg = acc.commCount > 0 ? acc.commSum / acc.commCount : null;
    let score: number | null = null;
    if (peerAvg !== null && commAvg !== null) score = 0.5 * peerAvg + 0.5 * commAvg;
    else if (peerAvg !== null) score = peerAvg;
    else if (commAvg !== null) score = commAvg;
    if (score !== null) out.set(targetId, valueToGrade(score));
  }
  return out;
}
