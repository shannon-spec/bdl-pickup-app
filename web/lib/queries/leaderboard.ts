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
  heroCount: number;
  pct: number;
};

export type LeaderboardData = {
  totalCompleted: number;
  minGames: number;
  topWins: LbPlayer[];
  topWinPct: LbPlayer[];
  topGamesPlayed: LbPlayer[];
  topGW: LbPlayer[];
  topHeroes: LbPlayer[];
  lowWinPct: LbPlayer[];
  topLosses: LbPlayer[];
  leagueOptions: { id: string; name: string }[];
  yearOptions: string[];
};

export async function getLeaderboard(opts: {
  leagueId?: string | null;
  year?: string | null;
  /**
   * Restrict league options + game pool to this set of league ids.
   * Pass null/undefined for the unrestricted case (admin view) — the
   * leaderboard then sees every league on the platform. Empty array
   * means "viewer has no leagues" and the leaderboard renders empty.
   */
  scopeLeagueIds?: string[] | null;
}): Promise<LeaderboardData> {
  // League option list — when scoped, drop leagues the viewer can't
  // see so the filter pills never reference a league they aren't in.
  const leagueOptionsAll = await db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .orderBy(asc(leagues.name));
  const leagueOptions = opts.scopeLeagueIds
    ? leagueOptionsAll.filter((l) => opts.scopeLeagueIds!.includes(l.id))
    : leagueOptionsAll;

  // Coerce a stale ?league= param to null when the viewer can't see
  // that league — happens when an admin link is shared with a player.
  const effectiveLeagueId =
    opts.leagueId &&
    leagueOptions.some((l) => l.id === opts.leagueId)
      ? opts.leagueId
      : null;

  // Year filter is applied with date prefix LIKE '2026-%'
  const yearPrefix = opts.year && opts.year !== "all" ? `${opts.year}-` : null;

  const gameWhere = and(
    effectiveLeagueId ? eq(games.leagueId, effectiveLeagueId) : undefined,
    // When no specific league is picked but the viewer is scoped, restrict
    // to leagues they can see — otherwise "All leagues" silently leaks
    // platform-wide data into a player's view.
    !effectiveLeagueId && opts.scopeLeagueIds
      ? opts.scopeLeagueIds.length > 0
        ? inArray(games.leagueId, opts.scopeLeagueIds)
        : sql`false`
      : undefined,
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
    {
      wins: number;
      losses: number;
      gamesPlayed: number;
      gameWinnerCount: number;
      heroCount: number;
    }
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
      heroCount: 0,
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
  // Game winner + hero counts (separate from W/L). A "hero" is the
  // gameWinner of a game decided by 3 points or fewer.
  for (const g of completed) {
    if (!g.gameWinner) continue;
    const cur = stats.get(g.gameWinner) ?? {
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      gameWinnerCount: 0,
      heroCount: 0,
    };
    cur.gameWinnerCount++;
    if (
      g.scoreA !== null &&
      g.scoreB !== null &&
      Math.abs(g.scoreA - g.scoreB) <= 3
    ) {
      cur.heroCount++;
    }
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
      heroCount: s.heroCount,
      pct: total > 0 ? (s.wins / total) * 100 : 0,
    });
  }

  const eligibleForRate = allPlayers.filter((p) => p.gamesPlayed >= minGames);

  const topWins = [...allPlayers]
    .sort((a, b) => b.wins - a.wins || a.gamesPlayed - b.gamesPlayed)
    .slice(0, 10);
  // Most games played — straight gamesPlayed sort. Tie-break on wins
  // so a high-attendance player who's also winning ranks above one
  // with the same GP but a worse record.
  const topGamesPlayed = [...allPlayers]
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.wins - a.wins)
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
  const topHeroes = [...allPlayers]
    .filter((p) => p.heroCount > 0)
    .sort((a, b) => b.heroCount - a.heroCount || a.gamesPlayed - b.gamesPlayed)
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
    topGamesPlayed,
    topGW,
    topHeroes,
    lowWinPct,
    topLosses,
    leagueOptions,
    yearOptions,
  };
}
