import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, players, leagues, games, gameStats, gameRoster } from "@/lib/db";

export type StatLine = {
  id: string;
  firstName: string;
  lastName: string;
  team: string | null;
  gp: number;
  pts: number;
  reb: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number | null;
  tpPct: number | null;
  ftPct: number | null;
  /** BDL Power Score — production × efficiency × winning × sample. */
  power: number;
};

export type LeaguePlayerStatsData = {
  players: StatLine[];
  totalGames: number;
  leagueOptions: { id: string; name: string }[];
  yearOptions: string[];
};

const n = (v: number | null) => v ?? 0;

/** Stat tracking starts this week — games before this date don't count
 *  toward player stats. (Monday of the current week.) */
export const STATS_START_DATE = "2026-06-22";

/**
 * Per-player aggregate box-score stats across a league's games (or all the
 * viewer's leagues). Totals + per-game averages + shooting %s. Mirrors the
 * leaderboard's league scoping / year filter.
 */
export async function getLeaguePlayerStats(opts: {
  leagueId?: string | null;
  year?: string | null;
  scopeLeagueIds?: string[] | null;
}): Promise<LeaguePlayerStatsData> {
  const leagueOptionsAll = await db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .orderBy(asc(leagues.name));
  const leagueOptions = opts.scopeLeagueIds
    ? leagueOptionsAll.filter((l) => opts.scopeLeagueIds!.includes(l.id))
    : leagueOptionsAll;

  const effectiveLeagueId =
    opts.leagueId && leagueOptions.some((l) => l.id === opts.leagueId)
      ? opts.leagueId
      : null;

  const yearPrefix = opts.year && opts.year !== "all" ? `${opts.year}-` : null;

  const gameWhere = and(
    effectiveLeagueId ? eq(games.leagueId, effectiveLeagueId) : undefined,
    !effectiveLeagueId && opts.scopeLeagueIds
      ? opts.scopeLeagueIds.length > 0
        ? inArray(games.leagueId, opts.scopeLeagueIds)
        : sql`false`
      : undefined,
    yearPrefix ? sql`${games.gameDate}::text LIKE ${yearPrefix + "%"}` : undefined,
    // Stat tracking begins this week.
    sql`${games.gameDate} >= ${STATS_START_DATE}`,
  );

  // Games in scope (for year options + total counted games).
  const scopeGames = await db
    .select({ id: games.id, gameDate: games.gameDate })
    .from(games)
    .where(gameWhere);
  const scopeIds = scopeGames.map((g) => g.id);

  const yearOptions = Array.from(
    new Set(scopeGames.map((g) => g.gameDate?.slice(0, 4)).filter(Boolean) as string[]),
  )
    .sort()
    .reverse();

  if (scopeIds.length === 0) {
    return { players: [], totalGames: 0, leagueOptions, yearOptions };
  }

  const rows = await db
    .select({
      gameId: gameStats.gameId,
      playerId: gameStats.playerId,
      firstName: players.firstName,
      lastName: players.lastName,
      teamAName: games.teamAName,
      teamBName: games.teamBName,
      side: gameRoster.side,
      scoreA: games.scoreA,
      scoreB: games.scoreB,
      winTeam: games.winTeam,
      minutes: gameStats.minutes,
      points: gameStats.points,
      rebounds: gameStats.rebounds,
      oreb: gameStats.oreb,
      dreb: gameStats.dreb,
      assists: gameStats.assists,
      steals: gameStats.steals,
      blocks: gameStats.blocks,
      turnovers: gameStats.turnovers,
      fouls: gameStats.fouls,
      fgm: gameStats.fgm,
      fga: gameStats.fga,
      tpm: gameStats.tpm,
      tpa: gameStats.tpa,
      ftm: gameStats.ftm,
      fta: gameStats.fta,
    })
    .from(gameStats)
    .innerJoin(players, eq(players.id, gameStats.playerId))
    .innerJoin(games, eq(games.id, gameStats.gameId))
    .leftJoin(
      gameRoster,
      and(
        eq(gameRoster.gameId, gameStats.gameId),
        eq(gameRoster.playerId, gameStats.playerId),
      ),
    )
    .where(inArray(gameStats.gameId, scopeIds));

  const gamesWithStats = new Set<string>();
  const agg = new Map<
    string,
    StatLine & {
      _games: Set<string>;
      _teams: Map<string, number>;
      _w: number;
      _l: number;
    }
  >();
  for (const r of rows) {
    gamesWithStats.add(r.gameId);
    let s = agg.get(r.playerId);
    if (!s) {
      s = {
        id: r.playerId,
        firstName: r.firstName,
        lastName: r.lastName,
        team: null,
        gp: 0,
        pts: 0,
        reb: 0,
        oreb: 0,
        dreb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pf: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0,
        ppg: 0,
        rpg: 0,
        apg: 0,
        spg: 0,
        bpg: 0,
        fgPct: null,
        tpPct: null,
        ftPct: null,
        power: 0,
        _games: new Set<string>(),
        _teams: new Map<string, number>(),
        _w: 0,
        _l: 0,
      };
      agg.set(r.playerId, s);
    }
    s._games.add(r.gameId);
    const teamName =
      r.side === "A" ? r.teamAName : r.side === "B" ? r.teamBName : null;
    if (teamName) s._teams.set(teamName, (s._teams.get(teamName) ?? 0) + 1);
    // Win/loss attribution for this player's side in this game.
    if (r.side === "A" || r.side === "B") {
      const decided =
        r.winTeam ??
        (r.scoreA !== null && r.scoreB !== null
          ? r.scoreA > r.scoreB
            ? "A"
            : r.scoreB > r.scoreA
              ? "B"
              : "Tie"
          : null);
      if (decided === "A" || decided === "B") {
        if (decided === r.side) s._w++;
        else s._l++;
      }
    }
    s.pts += n(r.points);
    s.reb += n(r.rebounds);
    s.oreb += n(r.oreb);
    s.dreb += n(r.dreb);
    s.ast += n(r.assists);
    s.stl += n(r.steals);
    s.blk += n(r.blocks);
    s.tov += n(r.turnovers);
    s.pf += n(r.fouls);
    s.fgm += n(r.fgm);
    s.fga += n(r.fga);
    s.tpm += n(r.tpm);
    s.tpa += n(r.tpa);
    s.ftm += n(r.ftm);
    s.fta += n(r.fta);
  }

  const out: StatLine[] = [];
  for (const s of agg.values()) {
    const gp = s._games.size;
    const per = (v: number) => (gp > 0 ? v / gp : 0);
    const pctOf = (m: number, a: number) => (a > 0 ? (m / a) * 100 : null);
    // Most-frequent team across this player's statted games.
    let team: string | null = null;
    let best = 0;
    for (const [name, count] of s._teams) {
      if (count > best) {
        best = count;
        team = name;
      }
    }
    // BDL Power Score: production × efficiency × winning × sample.
    const tovpg = per(s.tov);
    const base =
      per(s.pts) +
      1.2 * per(s.reb) +
      1.5 * per(s.ast) +
      2.5 * per(s.stl) +
      2.5 * per(s.blk) -
      1.0 * tovpg;
    const tsDenom = s.fga + 0.44 * s.fta;
    const ts = tsDenom > 0 ? s.pts / (2 * tsDenom) : null;
    const eff = ts !== null ? 0.6 + 0.8 * ts : 1.0;
    const decided = s._w + s._l;
    const winPct = decided > 0 ? s._w / decided : null;
    const win = winPct !== null ? 0.8 + 0.4 * winPct : 1.0;
    const conf = gp > 0 ? gp / (gp + 2) : 0;
    const power = Math.round(base * eff * win * conf * 2 * 10) / 10;

    out.push({
      ...s,
      team,
      gp,
      ppg: per(s.pts),
      rpg: per(s.reb),
      apg: per(s.ast),
      spg: per(s.stl),
      bpg: per(s.blk),
      fgPct: pctOf(s.fgm, s.fga),
      tpPct: pctOf(s.tpm, s.tpa),
      ftPct: pctOf(s.ftm, s.fta),
      power,
    });
  }
  out.sort((a, b) => b.power - a.power || b.ppg - a.ppg);

  return {
    players: out,
    totalGames: gamesWithStats.size,
    leagueOptions,
    yearOptions,
  };
}
