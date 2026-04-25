import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  players,
  leagues,
  leaguePlayers,
  games,
  gameRoster,
} from "@/lib/db";

export type LbPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  gameWinnerCount: number;
  pct: number;
};

export type LeaderboardData = {
  totalCompleted: number;
  minGames: number;
  topWins: LbPlayer[];
  topWinPct: LbPlayer[];
  topGW: LbPlayer[];
  lowWinPct: LbPlayer[];
  topLosses: LbPlayer[];
  leagueOptions: { id: string; name: string }[];
  yearOptions: string[];
};

export async function getLeaderboard(opts: {
  leagueId?: string | null;
  year?: string | null;
}): Promise<LeaderboardData> {
  const leagueOptions = await db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .orderBy(asc(leagues.name));

  // Year filter is applied with date prefix LIKE '2026-%'
  const yearPrefix = opts.year && opts.year !== "all" ? `${opts.year}-` : null;

  const gameWhere = and(
    opts.leagueId ? eq(games.leagueId, opts.leagueId) : undefined,
    yearPrefix ? sql`${games.gameDate}::text LIKE ${yearPrefix + "%"}` : undefined,
  );

  const allGames = await db.select().from(games).where(gameWhere);
  const completed = allGames.filter(
    (g) => (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null,
  );
  const totalCompleted = completed.length;
  const minGames = Math.max(1, Math.ceil(totalCompleted * 0.1));

  // Roster for completed games only
  const completedIds = completed.map((g) => g.id);
  const rosterRows = completedIds.length
    ? await db
        .select({
          gameId: gameRoster.gameId,
          playerId: gameRoster.playerId,
          side: gameRoster.side,
        })
        .from(gameRoster)
        .where(
          and(
            inArray(gameRoster.gameId, completedIds),
            inArray(gameRoster.side, ["A", "B"]),
          ),
        )
    : [];

  // All player names
  const playerRows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players)
    .orderBy(asc(players.lastName));
  const playerMap = new Map(playerRows.map((p) => [p.id, p]));

  // Compute W/L per player
  const completedById = new Map(completed.map((g) => [g.id, g]));
  const stats = new Map<
    string,
    { wins: number; losses: number; gamesPlayed: number; gameWinnerCount: number }
  >();
  for (const r of rosterRows) {
    if (r.side !== "A" && r.side !== "B") continue;
    const g = completedById.get(r.gameId);
    if (!g) continue;
    const win =
      g.winTeam ??
      (g.scoreA !== null && g.scoreB !== null
        ? g.scoreA > g.scoreB
          ? "A"
          : g.scoreB > g.scoreA
            ? "B"
            : "Tie"
        : null);
    if (!win) continue;
    const cur = stats.get(r.playerId) ?? {
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      gameWinnerCount: 0,
    };
    cur.gamesPlayed++;
    if (win === "Tie") {
      // Tie counts as gp but not w/l
    } else if (r.side === win) {
      cur.wins++;
    } else {
      cur.losses++;
    }
    stats.set(r.playerId, cur);
  }
  // Game winner counts (separate from W/L)
  for (const g of completed) {
    if (!g.gameWinner) continue;
    const cur = stats.get(g.gameWinner) ?? {
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      gameWinnerCount: 0,
    };
    cur.gameWinnerCount++;
    stats.set(g.gameWinner, cur);
  }

  const allPlayers: LbPlayer[] = [];
  for (const [id, s] of stats) {
    const p = playerMap.get(id);
    if (!p) continue;
    const total = s.wins + s.losses;
    allPlayers.push({
      id,
      firstName: p.firstName,
      lastName: p.lastName,
      wins: s.wins,
      losses: s.losses,
      gamesPlayed: s.gamesPlayed,
      gameWinnerCount: s.gameWinnerCount,
      pct: total > 0 ? (s.wins / total) * 100 : 0,
    });
  }

  const eligibleForRate = allPlayers.filter((p) => p.gamesPlayed >= minGames);

  const topWins = [...allPlayers]
    .sort((a, b) => b.wins - a.wins || a.gamesPlayed - b.gamesPlayed)
    .slice(0, 10);
  const topLosses = [...allPlayers]
    .sort((a, b) => b.losses - a.losses || b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10);
  const topWinPct = [...eligibleForRate]
    .sort((a, b) => b.pct - a.pct || b.wins - a.wins)
    .slice(0, 10);
  const lowWinPct = [...eligibleForRate]
    .sort((a, b) => a.pct - b.pct || b.losses - a.losses)
    .slice(0, 10);
  const topGW = [...allPlayers]
    .filter((p) => p.gameWinnerCount > 0)
    .sort(
      (a, b) =>
        b.gameWinnerCount - a.gameWinnerCount || a.gamesPlayed - b.gamesPlayed,
    )
    .slice(0, 10);

  // Year options derived from existing dates
  const dateYears = new Set<string>();
  for (const g of allGames) {
    if (g.gameDate) dateYears.add(g.gameDate.slice(0, 4));
  }
  const yearOptions = Array.from(dateYears).sort().reverse();

  return {
    totalCompleted,
    minGames,
    topWins,
    topWinPct,
    topGW,
    lowWinPct,
    topLosses,
    leagueOptions,
    yearOptions,
  };
}
