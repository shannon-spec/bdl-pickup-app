import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  players,
  leagues,
  leaguePlayers,
  games,
  gameRoster,
  type Player,
} from "@/lib/db";

export type PlayerLeagueStat = {
  leagueId: string;
  leagueName: string;
  wins: number;
  losses: number;
  pct: number | null;
  rank: number | null; // 1-indexed within the league among rate-eligible players
  // Attendance metric — same denominator as the home dashboard's
  // Games Played stat: how many of this league's completed nights the
  // player suited up for.
  played: number;
  leagueNights: number;
  playedPct: number | null;
  playedRank: number | null;
};

export type PlayerLastN = {
  id: string;
  date: string | null;
  leagueName: string | null;
  myScore: number | null;
  opScore: number | null;
  isWin: boolean;
  opName: string;
};

export type PlayerProfile = {
  player: Player;
  totalWins: number;
  totalLosses: number;
  totalGames: number;
  totalWinPct: number | null;
  streakType: "W" | "L" | null;
  streakCount: number;
  leagueCount: number;
  // Career attendance — sum across all the player's leagues.
  careerLeagueNights: number;
  careerPlayedPct: number | null;
  // The league where the player is most active. Used by the hero to
  // surface a single rank for Win % + Games Played %. Null when the
  // player has no completed games anywhere.
  topLeague: {
    id: string;
    name: string;
    winRank: number | null;
    playedRank: number | null;
  } | null;
  byLeague: PlayerLeagueStat[];
  lastN: PlayerLastN[];
};

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!player) return null;

  // All games where the player was on side A or B
  const rosterRows = await db
    .select({
      gameId: gameRoster.gameId,
      side: gameRoster.side,
    })
    .from(gameRoster)
    .where(
      and(
        eq(gameRoster.playerId, playerId),
        inArray(gameRoster.side, ["A", "B"]),
      ),
    );

  const myGameIds = rosterRows.map((r) => r.gameId);
  if (myGameIds.length === 0) {
    const myLeagues = await db
      .select({
        id: leagues.id,
        name: leagues.name,
      })
      .from(leagues)
      .innerJoin(leaguePlayers, eq(leaguePlayers.leagueId, leagues.id))
      .where(eq(leaguePlayers.playerId, playerId))
      .orderBy(asc(leagues.name));
    return {
      player,
      totalWins: 0,
      totalLosses: 0,
      totalGames: 0,
      totalWinPct: null,
      streakType: null,
      streakCount: 0,
      leagueCount: myLeagues.length,
      careerLeagueNights: 0,
      careerPlayedPct: null,
      topLeague: null,
      byLeague: myLeagues.map((l) => ({
        leagueId: l.id,
        leagueName: l.name,
        wins: 0,
        losses: 0,
        pct: null,
        rank: null,
        played: 0,
        leagueNights: 0,
        playedPct: null,
        playedRank: null,
      })),
      lastN: [],
    };
  }
  const sideMap = new Map(rosterRows.map((r) => [r.gameId, r.side]));

  const myGames = await db
    .select()
    .from(games)
    .where(inArray(games.id, myGameIds))
    .orderBy(asc(games.gameDate));

  const winOf = (g: (typeof myGames)[number]): "A" | "B" | "Tie" | null => {
    if (g.winTeam) return g.winTeam;
    if (g.scoreA !== null && g.scoreB !== null) {
      if (g.scoreA > g.scoreB) return "A";
      if (g.scoreB > g.scoreA) return "B";
      return "Tie";
    }
    return null;
  };
  const isComplete = (g: (typeof myGames)[number]) =>
    (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;

  const completed = myGames.filter(isComplete);

  let totalWins = 0;
  let totalLosses = 0;
  for (const g of completed) {
    const side = sideMap.get(g.id);
    const w = winOf(g);
    if (!side || !w || w === "Tie") continue;
    if (side === w) totalWins++;
    else totalLosses++;
  }
  const totalGames = totalWins + totalLosses;
  const totalWinPct = totalGames > 0 ? (totalWins / totalGames) * 100 : null;

  // Streak — most recent first
  let streakType: "W" | "L" | null = null;
  let streakCount = 0;
  for (let i = completed.length - 1; i >= 0; i--) {
    const g = completed[i];
    const side = sideMap.get(g.id);
    const w = winOf(g);
    if (!side || !w || w === "Tie") break;
    const won = side === w;
    if (streakType === null) {
      streakType = won ? "W" : "L";
      streakCount = 1;
    } else if (streakType === (won ? "W" : "L")) streakCount++;
    else break;
  }

  // Per-league breakdown
  const myLeagues = await db
    .select({
      id: leagues.id,
      name: leagues.name,
    })
    .from(leagues)
    .innerJoin(leaguePlayers, eq(leaguePlayers.leagueId, leagues.id))
    .where(eq(leaguePlayers.playerId, playerId))
    .orderBy(asc(leagues.name));

  const byLeague: PlayerLeagueStat[] = [];
  for (const l of myLeagues) {
    const inLeague = completed.filter((g) => g.leagueId === l.id);
    let w = 0,
      ll = 0;
    for (const g of inLeague) {
      const side = sideMap.get(g.id);
      const win = winOf(g);
      if (!side || !win || win === "Tie") continue;
      if (side === win) w++;
      else ll++;
    }
    const total = w + ll;
    const pct = total > 0 ? (w / total) * 100 : null;

    // Pull league rosters once and derive both ranks (Win %, Played %)
    // from the same dataset.
    const allRosterRows = await db
      .select({
        gameId: gameRoster.gameId,
        playerId: gameRoster.playerId,
        side: gameRoster.side,
      })
      .from(gameRoster)
      .innerJoin(games, eq(games.id, gameRoster.gameId))
      .where(
        and(
          eq(games.leagueId, l.id),
          inArray(gameRoster.side, ["A", "B"]),
        ),
      );
    const allLeagueGames = await db
      .select()
      .from(games)
      .where(eq(games.leagueId, l.id));
    const completedGames = allLeagueGames.filter(isComplete);
    const leagueNights = completedGames.length;
    const completedById = new Map(completedGames.map((g) => [g.id, g]));

    // Per-player W/L (decisions) AND played games (any completed game
    // they were rostered for, even ties).
    const stats = new Map<string, { w: number; l: number; played: number }>();
    for (const r of allRosterRows) {
      const g = completedById.get(r.gameId);
      if (!g) continue;
      const cur = stats.get(r.playerId) ?? { w: 0, l: 0, played: 0 };
      cur.played++;
      const win = winOf(g);
      if (win && win !== "Tie") {
        if (r.side === win) cur.w++;
        else cur.l++;
      }
      stats.set(r.playerId, cur);
    }

    // Rank by Win % — only players with ≥10% league games qualify.
    let rank: number | null = null;
    if (pct !== null) {
      const minGames = Math.max(1, Math.ceil(leagueNights * 0.1));
      const ranked = Array.from(stats.entries())
        .filter(([, s]) => s.w + s.l >= minGames)
        .map(([id, s]) => ({
          id,
          pct: s.w + s.l > 0 ? (s.w / (s.w + s.l)) * 100 : 0,
          wins: s.w,
        }))
        .sort((a, b) => b.pct - a.pct || b.wins - a.wins);
      const idx = ranked.findIndex((r) => r.id === playerId);
      if (idx >= 0) rank = idx + 1;
    }

    // Rank by Games Played % — straight ordinal across everyone in
    // the league. Ties broken by raw played count.
    let playedRank: number | null = null;
    const myPlayed = stats.get(playerId)?.played ?? 0;
    const playedPct =
      leagueNights > 0 ? (myPlayed / leagueNights) * 100 : null;
    if (playedPct !== null && myPlayed > 0) {
      const ranked = Array.from(stats.entries())
        .map(([id, s]) => ({
          id,
          played: s.played,
        }))
        .sort((a, b) => b.played - a.played);
      const idx = ranked.findIndex((r) => r.id === playerId);
      if (idx >= 0) playedRank = idx + 1;
    }

    byLeague.push({
      leagueId: l.id,
      leagueName: l.name,
      wins: w,
      losses: ll,
      pct,
      rank,
      played: myPlayed,
      leagueNights,
      playedPct,
      playedRank,
    });
  }

  // Career attendance = sum of league nights across all the player's
  // leagues; played count is the sum of per-league played values.
  const careerLeagueNights = byLeague.reduce(
    (n, s) => n + s.leagueNights,
    0,
  );
  const careerPlayed = byLeague.reduce((n, s) => n + s.played, 0);
  const careerPlayedPct =
    careerLeagueNights > 0
      ? (careerPlayed / careerLeagueNights) * 100
      : null;

  // Pick the league the player is most active in for the hero's rank
  // surfacing — most games played wins, ties broken by name.
  const topLeagueRow = [...byLeague].sort(
    (a, b) =>
      b.played - a.played || a.leagueName.localeCompare(b.leagueName),
  )[0];
  const topLeague =
    topLeagueRow && topLeagueRow.played > 0
      ? {
          id: topLeagueRow.leagueId,
          name: topLeagueRow.leagueName,
          winRank: topLeagueRow.rank,
          playedRank: topLeagueRow.playedRank,
        }
      : null;

  // Last 10
  const lastN: PlayerLastN[] = completed
    .slice(-10)
    .reverse()
    .map((g) => {
      const side = sideMap.get(g.id);
      const win = winOf(g);
      const isWin = !!side && win === side;
      const myScore = side === "A" ? g.scoreA : g.scoreB;
      const opScore = side === "A" ? g.scoreB : g.scoreA;
      const opName =
        side === "A" ? g.teamBName ?? "Dark" : g.teamAName ?? "White";
      return {
        id: g.id,
        date: g.gameDate,
        leagueName: g.leagueName,
        myScore,
        opScore,
        isWin,
        opName,
      };
    });

  return {
    player,
    totalWins,
    totalLosses,
    totalGames,
    totalWinPct,
    streakType,
    streakCount,
    leagueCount: myLeagues.length,
    careerLeagueNights,
    careerPlayedPct,
    topLeague,
    byLeague,
    lastN,
  };
}

// Suppress unused-import warnings
export const __profileMarker = sql`/* profile */`;
void desc;
