/**
 * Player grading aggregate — league-scoped.
 *
 * Each voter casts at most one grade per (target, league). The
 * voter's bucket (peer vs commissioner) is derived at read time:
 * the voter is a commissioner ONLY when they commission THIS
 * specific league. So the same person can be a commissioner-voter
 * in League A and a peer-voter in League B.
 *
 * Final score (computed per league):
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
  leagues,
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
  /** Crowd-derived grade for THIS league. Null when no votes here. */
  crowdGrade: GradeKey | null;
  /** Numeric blend in 1..5; null when no votes. */
  crowdScore: number | null;
  peerCount: number;
  commissionerCount: number;
  /** The viewer's own vote on this target in this league, if any. */
  myVote: GradeKey | null;
  /**
   * True when the viewer can cast a vote in THIS league: signed in,
   * has a player record, is a member of the league, and isn't the
   * target (self-vote allowed).
   */
  canVote: boolean;
};

/**
 * League-scoped grade aggregate for a single player.
 *
 * `leagueId` is required: this is the league the grade is being
 * attributed to. Without a league context grades aren't meaningful,
 * so callers that don't have a league should use
 * `getPlayerGradesByLeague` instead and choose a league themselves.
 */
export async function getPlayerGradeAggregate(
  targetId: string,
  leagueId: string,
  session: Session | null,
): Promise<PlayerGradeAggregate> {
  // Pull votes for this (target, league) plus the commissioners of
  // this specific league. Commissioner status is league-scoped.
  const [votes, commRows] = await Promise.all([
    db
      .select({
        voterId: playerGrades.voterPlayerId,
        grade: playerGrades.grade,
      })
      .from(playerGrades)
      .where(
        and(
          eq(playerGrades.targetPlayerId, targetId),
          eq(playerGrades.leagueId, leagueId),
        ),
      ),
    db
      .select({ playerId: leagueCommissioners.playerId })
      .from(leagueCommissioners)
      .where(eq(leagueCommissioners.leagueId, leagueId)),
  ]);

  const commissionerIds = new Set(commRows.map((r) => r.playerId));

  let peerSum = 0;
  let peerCount = 0;
  let commSum = 0;
  let commCount = 0;
  let myVote: GradeKey | null = null;
  for (const v of votes) {
    const num = GRADE_VALUE[v.grade as GradeKey];
    if (num === null) continue;
    // Commissioner authority is for grading OTHER players. A
    // commissioner self-vote drops to the peer bucket so they
    // can't single-handedly swing 50% of their own grade by
    // checking a tier on their own profile.
    const isSelfVote = v.voterId === targetId;
    const isCommish = commissionerIds.has(v.voterId) && !isSelfVote;
    if (isCommish) {
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

  // Eligibility: voter must be a member of THIS league. Self-voting
  // allowed (you're still in your own league).
  let canVote = false;
  if (session?.playerId) {
    if (session.playerId === targetId) {
      // Voter must still be a member of this league to cast.
      const [self] = await db
        .select({ leagueId: leaguePlayers.leagueId })
        .from(leaguePlayers)
        .where(
          and(
            eq(leaguePlayers.playerId, session.playerId),
            eq(leaguePlayers.leagueId, leagueId),
          ),
        )
        .limit(1);
      canVote = !!self;
    } else {
      const [voterMember, targetMember] = await Promise.all([
        db
          .select({ leagueId: leaguePlayers.leagueId })
          .from(leaguePlayers)
          .where(
            and(
              eq(leaguePlayers.playerId, session.playerId),
              eq(leaguePlayers.leagueId, leagueId),
            ),
          )
          .limit(1),
        db
          .select({ leagueId: leaguePlayers.leagueId })
          .from(leaguePlayers)
          .where(
            and(
              eq(leaguePlayers.playerId, targetId),
              eq(leaguePlayers.leagueId, leagueId),
            ),
          )
          .limit(1),
      ]);
      canVote = !!voterMember[0] && !!targetMember[0];
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
 * crowdGrade> populated only for targets with at least one vote in
 * the given league. Skips eligibility / myVote.
 */
export async function getCrowdGradesForPlayers(
  targetIds: string[],
  leagueId: string,
): Promise<Map<string, GradeKey>> {
  const out = new Map<string, GradeKey>();
  if (targetIds.length === 0) return out;

  const [votes, commRows] = await Promise.all([
    db
      .select({
        targetId: playerGrades.targetPlayerId,
        voterId: playerGrades.voterPlayerId,
        grade: playerGrades.grade,
      })
      .from(playerGrades)
      .where(
        and(
          inArray(playerGrades.targetPlayerId, targetIds),
          eq(playerGrades.leagueId, leagueId),
        ),
      ),
    db
      .select({ playerId: leagueCommissioners.playerId })
      .from(leagueCommissioners)
      .where(eq(leagueCommissioners.leagueId, leagueId)),
  ]);

  if (votes.length === 0) return out;
  const commissionerIds = new Set(commRows.map((r) => r.playerId));

  type Acc = { peerSum: number; peerCount: number; commSum: number; commCount: number };
  const buckets = new Map<string, Acc>();
  for (const v of votes) {
    const num = GRADE_VALUE[v.grade as GradeKey];
    if (num === null) continue;
    const acc =
      buckets.get(v.targetId) ?? {
        peerSum: 0,
        peerCount: 0,
        commSum: 0,
        commCount: 0,
      };
    // Commissioner self-vote falls to the peer bucket — see
    // getPlayerGradeAggregate for the rationale.
    const isSelfVote = v.voterId === v.targetId;
    const isCommish = commissionerIds.has(v.voterId) && !isSelfVote;
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

/**
 * Per-league grade breakdown for a single target. Used by the
 * profile page (one row per league the target is in) and by the
 * directory hover-tooltip.
 *
 * Returns rows ONLY for leagues the target is currently a member
 * of, even if older votes exist for leagues they've since left.
 */
export type LeagueGradeRow = {
  leagueId: string;
  leagueName: string;
  /** Crowd-derived grade — null when no votes in this league. */
  crowdGrade: GradeKey | null;
  /** Admin-set per-league override (leaguePlayers.leagueLevel). Null
   *  when no override; falls back to player.level upstream. */
  adminLevel: GradeKey | null;
  peerCount: number;
  commissionerCount: number;
};

export async function getPlayerGradesByLeague(
  targetId: string,
): Promise<LeagueGradeRow[]> {
  const [memberships, votes, allCommRows] = await Promise.all([
    db
      .select({
        leagueId: leaguePlayers.leagueId,
        leagueName: leagues.name,
        leagueLevel: leaguePlayers.leagueLevel,
      })
      .from(leaguePlayers)
      .innerJoin(leagues, eq(leagues.id, leaguePlayers.leagueId))
      .where(eq(leaguePlayers.playerId, targetId)),
    db
      .select({
        leagueId: playerGrades.leagueId,
        voterId: playerGrades.voterPlayerId,
        grade: playerGrades.grade,
      })
      .from(playerGrades)
      .where(eq(playerGrades.targetPlayerId, targetId)),
    db
      .select({
        leagueId: leagueCommissioners.leagueId,
        playerId: leagueCommissioners.playerId,
      })
      .from(leagueCommissioners),
  ]);

  if (memberships.length === 0) return [];

  // league → commissioner set
  const commByLeague = new Map<string, Set<string>>();
  for (const r of allCommRows) {
    const s = commByLeague.get(r.leagueId) ?? new Set<string>();
    s.add(r.playerId);
    commByLeague.set(r.leagueId, s);
  }

  // league → accumulator
  type Acc = { peerSum: number; peerCount: number; commSum: number; commCount: number };
  const buckets = new Map<string, Acc>();
  for (const v of votes) {
    const num = GRADE_VALUE[v.grade as GradeKey];
    if (num === null) continue;
    const acc =
      buckets.get(v.leagueId) ?? {
        peerSum: 0,
        peerCount: 0,
        commSum: 0,
        commCount: 0,
      };
    // Commissioner self-vote falls to the peer bucket — see
    // getPlayerGradeAggregate for the rationale.
    const isSelfVote = v.voterId === targetId;
    const isComm =
      (commByLeague.get(v.leagueId)?.has(v.voterId) ?? false) && !isSelfVote;
    if (isComm) {
      acc.commSum += num;
      acc.commCount++;
    } else {
      acc.peerSum += num;
      acc.peerCount++;
    }
    buckets.set(v.leagueId, acc);
  }

  return memberships.map((m) => {
    const acc = buckets.get(m.leagueId);
    let crowdGrade: GradeKey | null = null;
    if (acc) {
      const peerAvg = acc.peerCount > 0 ? acc.peerSum / acc.peerCount : null;
      const commAvg = acc.commCount > 0 ? acc.commSum / acc.commCount : null;
      let score: number | null = null;
      if (peerAvg !== null && commAvg !== null) score = 0.5 * peerAvg + 0.5 * commAvg;
      else if (peerAvg !== null) score = peerAvg;
      else if (commAvg !== null) score = commAvg;
      if (score !== null) crowdGrade = valueToGrade(score);
    }
    const ll = m.leagueLevel as string | null;
    const adminLevel: GradeKey | null =
      ll && ll !== "Not Rated" && (VOTABLE_GRADES as string[]).includes(ll)
        ? (ll as GradeKey)
        : null;
    return {
      leagueId: m.leagueId,
      leagueName: m.leagueName,
      crowdGrade,
      adminLevel,
      peerCount: acc?.peerCount ?? 0,
      commissionerCount: acc?.commCount ?? 0,
    };
  });
}
