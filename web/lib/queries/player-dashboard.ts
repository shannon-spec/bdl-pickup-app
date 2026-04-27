/**
 * Server-side query layer for the Player Dashboard.
 *
 * Uses Drizzle's typed query builder throughout — no raw SQL, no type
 * gymnastics. Computations that don't map cleanly to SQL (streaks,
 * percentages, normalization) happen in TypeScript on the result set.
 *
 * The dataset is small (one league, ~30 players, ~30 games) so
 * pull-and-compute is plenty fast and easier to verify than SQL-side
 * aggregates.
 */
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  players,
  leagues,
  leaguePlayers,
  games,
  gameRoster,
  type Player,
  type Game,
  type League,
} from "@/lib/db";
import { getMatchupOdds } from "@/lib/queries/games";

/* ---------- Helpers ---------- */

function gameWinTeam(g: Game): "A" | "B" | "Tie" | null {
  if (g.winTeam) return g.winTeam;
  if (g.scoreA !== null && g.scoreB !== null) {
    if (g.scoreA > g.scoreB) return "A";
    if (g.scoreB > g.scoreA) return "B";
    return "Tie";
  }
  return null;
}

function isComplete(g: Game): boolean {
  return (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;
}

/* ---------- League context ---------- */

export async function getPlayerLeagues(playerId: string): Promise<League[]> {
  return db
    .select()
    .from(leagues)
    .innerJoin(leaguePlayers, eq(leaguePlayers.leagueId, leagues.id))
    .where(eq(leaguePlayers.playerId, playerId))
    .orderBy(asc(leagues.name))
    .then((rows) => rows.map((r) => r.leagues));
}

/* ---------- Per-league game roster sides for a player ---------- */

async function getPlayerSidesByGame(
  playerId: string,
  leagueId: string,
): Promise<Map<string, "A" | "B">> {
  const rows = await db
    .select({ gameId: gameRoster.gameId, side: gameRoster.side })
    .from(gameRoster)
    .innerJoin(games, eq(games.id, gameRoster.gameId))
    .where(
      and(
        eq(games.leagueId, leagueId),
        eq(gameRoster.playerId, playerId),
        inArray(gameRoster.side, ["A", "B"]),
      ),
    );
  const map = new Map<string, "A" | "B">();
  for (const r of rows) {
    if (r.side === "A" || r.side === "B") map.set(r.gameId, r.side);
  }
  return map;
}

/* ---------- Season stats ---------- */

export type SeasonStats = {
  wins: number;
  losses: number;
  played: number;
  winPct: number | null;
  last5Delta: number | null;
  gamesPlayedPct: number | null;
  myCompletedCount: number;
  leagueCompletedCount: number;
  streakType: "W" | "L" | null;
  streakCount: number;
  totalWeeks: number;
  weekOf: number;
};

export async function getSeasonStats(
  playerId: string,
  leagueId: string,
): Promise<SeasonStats> {
  const allGames = await db
    .select()
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(asc(games.gameDate));

  const completedAll = allGames.filter(isComplete);
  const sides = await getPlayerSidesByGame(playerId, leagueId);
  const myCompleted = completedAll.filter((g) => sides.has(g.id));

  let wins = 0;
  let losses = 0;
  for (const g of myCompleted) {
    const side = sides.get(g.id)!;
    const win = gameWinTeam(g);
    if (!win || win === "Tie") continue;
    if (side === win) wins++;
    else losses++;
  }
  const played = wins + losses;
  const winPct = played > 0 ? (wins / played) * 100 : null;

  const last5 = myCompleted.slice(-5);
  const prior = myCompleted.slice(0, Math.max(0, myCompleted.length - 5));
  const last5Wins = last5.filter((g) => sides.get(g.id) === gameWinTeam(g)).length;
  const priorWins = prior.filter((g) => sides.get(g.id) === gameWinTeam(g)).length;
  const last5Pct = last5.length > 0 ? (last5Wins / last5.length) * 100 : 0;
  const priorPct = prior.length > 0 ? (priorWins / prior.length) * 100 : 0;
  const last5Delta =
    last5.length > 0 && prior.length > 0
      ? Number((last5Pct - priorPct).toFixed(1))
      : null;

  const leagueCompletedCount = completedAll.length;
  const myCompletedCount = myCompleted.length;
  const gamesPlayedPct =
    leagueCompletedCount > 0
      ? Math.round((myCompletedCount / leagueCompletedCount) * 100)
      : null;

  let streakType: "W" | "L" | null = null;
  let streakCount = 0;
  for (let i = myCompleted.length - 1; i >= 0; i--) {
    const g = myCompleted[i];
    const side = sides.get(g.id)!;
    const win = gameWinTeam(g);
    if (!win || win === "Tie") break;
    const isWin = side === win;
    if (streakType === null) {
      streakType = isWin ? "W" : "L";
      streakCount = 1;
    } else if (streakType === (isWin ? "W" : "L")) {
      streakCount++;
    } else break;
  }

  const totalWeeks = allGames.length;
  const weekOf = Math.min(totalWeeks, completedAll.length + 1);

  return {
    wins,
    losses,
    played,
    winPct,
    last5Delta,
    gamesPlayedPct,
    myCompletedCount,
    leagueCompletedCount,
    streakType,
    streakCount,
    totalWeeks,
    weekOf,
  };
}

/* ---------- Last 5 games (player) ---------- */

export type FormCard = {
  id: string;
  date: string | null;
  myScore: number | null;
  opScore: number | null;
  isWin: boolean;
  isTie: boolean;
  opName: string;
  heroId: string | null;
  heroName: string | null;
};

export async function getLastFive(
  playerId: string,
  leagueId: string,
): Promise<FormCard[]> {
  const allGames = await db
    .select()
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(asc(games.gameDate));

  const completed = allGames.filter(isComplete);
  const sides = await getPlayerSidesByGame(playerId, leagueId);
  const mine = completed.filter((g) => sides.has(g.id)).slice(-5).reverse();

  const heroIds = Array.from(
    new Set(mine.map((g) => g.gameWinner).filter((x): x is string => !!x)),
  );
  const heroNameById = new Map<string, string>();
  if (heroIds.length > 0) {
    const rows = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
      })
      .from(players)
      .where(inArray(players.id, heroIds));
    for (const r of rows) {
      heroNameById.set(r.id, `${r.firstName} ${r.lastName}`);
    }
  }

  return mine.map((g) => {
    const side = sides.get(g.id)!;
    const win = gameWinTeam(g);
    const isTie = win === "Tie";
    const isWin = !!side && !!win && side === win;
    const myScore = side === "A" ? g.scoreA : g.scoreB;
    const opScore = side === "A" ? g.scoreB : g.scoreA;
    const opName =
      side === "A" ? g.teamBName ?? "Dark" : g.teamAName ?? "White";
    return {
      id: g.id,
      date: g.gameDate,
      myScore,
      opScore,
      isWin,
      isTie,
      opName,
      heroId: g.gameWinner ?? null,
      heroName: g.gameWinner ? heroNameById.get(g.gameWinner) ?? null : null,
    };
  });
}

/* ---------- Win-prob from last-5 league games ---------- */

function computeProbFromLast5(completed: Game[]): {
  probA: number;
  probB: number;
  aW: number;
  bW: number;
  aTot: number;
  bTot: number;
} {
  let aW = 0, aTot = 0, bW = 0, bTot = 0;
  for (const g of completed.slice(-5)) {
    const w = gameWinTeam(g);
    if (!w || w === "Tie") continue;
    if (w === "A") {
      aW++;
      aTot++;
      bTot++;
    } else {
      bW++;
      bTot++;
      aTot++;
    }
  }
  const aRate = aTot > 0 ? aW / aTot : 0.5;
  const bRate = bTot > 0 ? bW / bTot : 0.5;
  const denom = aRate + bRate || 1;
  const probA = Math.round((aRate / denom) * 100);
  const probB = 100 - probA;
  return { probA, probB, aW, bW, aTot, bTot };
}

/* ---------- Next game ---------- */

export type NextGame = {
  id: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  format: Game["format"];
  teamAName: string;
  teamBName: string;
  mySide: "A" | "B" | null;
  probA: number;
  probB: number;
  teamARecord: { w: number; l: number };
  teamBRecord: { w: number; l: number };
  rosterA: Pick<Player, "id" | "firstName" | "lastName">[];
  rosterB: Pick<Player, "id" | "firstName" | "lastName">[];
};

export async function getNextGame(
  playerId: string,
  leagueId: string,
): Promise<NextGame | null> {
  const today = new Date().toISOString().slice(0, 10);
  const all = await db
    .select()
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(asc(games.gameDate));

  const open = all.filter((g) => !isComplete(g) && (g.gameDate ?? "") >= today);
  if (open.length === 0) return null;

  const sides = await getPlayerSidesByGame(playerId, leagueId);
  const mine = open.find((g) => sides.has(g.id));
  const next = mine ?? open[0];

  // Last-5 team-color record only powers the small "X-Y last 5" label
  // under each team name. The odds bar uses the new blended model
  // (last-8 trend + roster win %) so the home card stays in sync with
  // /games and /games/[id].
  const completed = all.filter(isComplete);
  const { aW, bW, aTot, bTot } = computeProbFromLast5(completed);

  const rosterRows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      side: gameRoster.side,
    })
    .from(gameRoster)
    .innerJoin(players, eq(players.id, gameRoster.playerId))
    .where(eq(gameRoster.gameId, next.id))
    .orderBy(asc(players.lastName), asc(players.firstName));
  const rosterA = rosterRows
    .filter((r) => r.side === "A")
    .map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }));
  const rosterB = rosterRows
    .filter((r) => r.side === "B")
    .map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }));

  const odds = await getMatchupOdds(
    leagueId,
    rosterA.map((p) => p.id),
    rosterB.map((p) => p.id),
  );
  const probA = odds?.probA ?? 50;
  const probB = odds?.probB ?? 50;

  return {
    id: next.id,
    date: next.gameDate,
    time: next.gameTime,
    venue: next.venue,
    format: next.format,
    teamAName: next.teamAName ?? "White",
    teamBName: next.teamBName ?? "Dark",
    mySide: sides.get(next.id) ?? null,
    probA,
    probB,
    teamARecord: { w: aW, l: aTot - aW },
    teamBRecord: { w: bW, l: bTot - bW },
    rosterA,
    rosterB,
  };
}

/* ---------- Upcoming markets ---------- */

export type UpcomingMarket = {
  id: string;
  date: string | null;
  time: string | null;
  teamAName: string;
  teamBName: string;
  mySide: "A" | "B" | null;
  probA: number;
  probB: number;
};

export async function getUpcomingMarkets(
  playerId: string,
  leagueId: string,
  limit = 5,
): Promise<UpcomingMarket[]> {
  const today = new Date().toISOString().slice(0, 10);
  const all = await db
    .select()
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(asc(games.gameDate));

  const open = all
    .filter((g) => !isComplete(g) && (g.gameDate ?? "") >= today)
    .slice(0, limit);
  if (open.length === 0) return [];

  const sides = await getPlayerSidesByGame(playerId, leagueId);

  // Per-game blended odds. Pull rosters for the open games in one shot,
  // then compute matchup odds per game so each card reflects who's
  // actually on the floor for that night.
  const openIds = open.map((g) => g.id);
  const rosterRows =
    openIds.length > 0
      ? await db
          .select({
            gameId: gameRoster.gameId,
            playerId: gameRoster.playerId,
            side: gameRoster.side,
          })
          .from(gameRoster)
          .where(inArray(gameRoster.gameId, openIds))
      : [];
  const aByGame = new Map<string, string[]>();
  const bByGame = new Map<string, string[]>();
  for (const r of rosterRows) {
    if (r.side === "A") {
      const arr = aByGame.get(r.gameId) ?? [];
      arr.push(r.playerId);
      aByGame.set(r.gameId, arr);
    } else if (r.side === "B") {
      const arr = bByGame.get(r.gameId) ?? [];
      arr.push(r.playerId);
      bByGame.set(r.gameId, arr);
    }
  }
  const oddsByGame = new Map<string, { probA: number; probB: number }>();
  await Promise.all(
    open.map(async (g) => {
      const odds = await getMatchupOdds(
        leagueId,
        aByGame.get(g.id) ?? [],
        bByGame.get(g.id) ?? [],
      );
      oddsByGame.set(g.id, {
        probA: odds?.probA ?? 50,
        probB: odds?.probB ?? 50,
      });
    }),
  );

  return open.map((g) => {
    const o = oddsByGame.get(g.id) ?? { probA: 50, probB: 50 };
    return {
      id: g.id,
      date: g.gameDate,
      time: g.gameTime,
      teamAName: g.teamAName ?? "White",
      teamBName: g.teamBName ?? "Dark",
      mySide: sides.get(g.id) ?? null,
      probA: o.probA,
      probB: o.probB,
    };
  });
}

/* ---------- Leaderboard (top 5 with 10% qualification) ---------- */

export type LeaderRow = {
  player: Pick<Player, "id" | "firstName" | "lastName">;
  wins: number;
  losses: number;
  pct: number;
  isMe: boolean;
};

export async function getLeaderboard(
  leagueId: string,
  meId: string | null,
  limit = 5,
): Promise<LeaderRow[]> {
  // 1. All completed games in the league
  const allGames = await db
    .select()
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(asc(games.gameDate));
  const completed = allGames.filter(isComplete);
  const totalCompleted = completed.length;
  const minGames = Math.max(1, Math.ceil(totalCompleted * 0.1));
  if (totalCompleted === 0) return [];

  // 2. Roster sides for every player in those games
  const completedIds = completed.map((g) => g.id);
  if (completedIds.length === 0) return [];
  const rosterRows = await db
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
    );

  // 3. League players (display names + filter to in-league)
  const lp = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players)
    .innerJoin(leaguePlayers, eq(leaguePlayers.playerId, players.id))
    .where(eq(leaguePlayers.leagueId, leagueId));
  const leaguePlayerIds = new Set(lp.map((p) => p.id));
  const playerInfo = new Map(lp.map((p) => [p.id, p]));

  // 4. Compute W/L per player
  const completedById = new Map(completed.map((g) => [g.id, g]));
  const stats = new Map<string, { w: number; l: number }>();
  for (const r of rosterRows) {
    if (!leaguePlayerIds.has(r.playerId)) continue;
    if (r.side !== "A" && r.side !== "B") continue;
    const g = completedById.get(r.gameId);
    if (!g) continue;
    const win = gameWinTeam(g);
    if (!win || win === "Tie") continue;
    const cur = stats.get(r.playerId) ?? { w: 0, l: 0 };
    if (r.side === win) cur.w++;
    else cur.l++;
    stats.set(r.playerId, cur);
  }

  // 5. Rank
  const ranked: LeaderRow[] = [];
  for (const [id, s] of stats) {
    const total = s.w + s.l;
    if (total < minGames) continue;
    const p = playerInfo.get(id);
    if (!p) continue;
    ranked.push({
      player: { id: p.id, firstName: p.firstName, lastName: p.lastName },
      wins: s.w,
      losses: s.l,
      pct: total > 0 ? (s.w / total) * 100 : 0,
      isMe: id === meId,
    });
  }
  ranked.sort((a, b) => b.pct - a.pct || b.wins - a.wins);
  return ranked.slice(0, limit);
}

/* ---------- Recent activity ---------- */

export type ActivityItem = {
  id: string;
  date: string | null;
  winnerName: string;
  loserName: string;
  winnerScore: number | null;
  loserScore: number | null;
  heroId: string | null;
  heroName: string | null;
  scoreA: number | null;
  scoreB: number | null;
};

export async function getRecentActivity(
  leagueId: string,
  limit = 3,
): Promise<ActivityItem[]> {
  const all = await db
    .select()
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(desc(games.gameDate));

  const taken: Game[] = [];
  for (const g of all) {
    if (!isComplete(g)) continue;
    const w = gameWinTeam(g);
    if (!w || w === "Tie") continue;
    taken.push(g);
    if (taken.length >= limit) break;
  }

  const heroIds = Array.from(
    new Set(taken.map((g) => g.gameWinner).filter((x): x is string => !!x)),
  );
  const heroNameById = new Map<string, string>();
  if (heroIds.length > 0) {
    const rows = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
      })
      .from(players)
      .where(inArray(players.id, heroIds));
    for (const r of rows) {
      heroNameById.set(r.id, `${r.firstName} ${r.lastName}`);
    }
  }

  return taken.map((g) => {
    const w = gameWinTeam(g)!;
    return {
      id: g.id,
      date: g.gameDate,
      winnerName: w === "A" ? g.teamAName ?? "White" : g.teamBName ?? "Dark",
      loserName: w === "A" ? g.teamBName ?? "Dark" : g.teamAName ?? "White",
      winnerScore: w === "A" ? g.scoreA : g.scoreB,
      loserScore: w === "A" ? g.scoreB : g.scoreA,
      heroId: g.gameWinner ?? null,
      heroName: g.gameWinner ? heroNameById.get(g.gameWinner) ?? null : null,
      scoreA: g.scoreA,
      scoreB: g.scoreB,
    };
  });
}

/* ---------- Discover (leagues player isn't in) ---------- */

export type DiscoverLeague = {
  id: string;
  name: string;
  schedule: string | null;
  description: string | null;
  level: string;
  playerCount: number;
  maxPlayers: number | null;
  spots: number | null;
};

export async function getDiscoverLeagues(
  playerId: string,
  limit = 5,
): Promise<DiscoverLeague[]> {
  const memberLeagueIds = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.playerId, playerId));
  const memberSet = new Set(memberLeagueIds.map((r) => r.leagueId));

  const all = await db.select().from(leagues).orderBy(asc(leagues.name));
  const others = all.filter((l) => !memberSet.has(l.id)).slice(0, limit);
  if (others.length === 0) return [];

  const otherIds = others.map((l) => l.id);
  const counts = await db
    .select({
      leagueId: leaguePlayers.leagueId,
      n: count(),
    })
    .from(leaguePlayers)
    .where(inArray(leaguePlayers.leagueId, otherIds))
    .groupBy(leaguePlayers.leagueId);
  const countMap = new Map(counts.map((r) => [r.leagueId, Number(r.n)]));

  return others.map((l) => {
    const playerCount = countMap.get(l.id) ?? 0;
    const spots =
      l.maxPlayers !== null && l.maxPlayers !== undefined
        ? Math.max(0, l.maxPlayers - playerCount)
        : null;
    return {
      id: l.id,
      name: l.name,
      schedule: l.schedule ?? null,
      description: l.description ?? null,
      level: l.level,
      playerCount,
      maxPlayers: l.maxPlayers ?? null,
      spots,
    };
  });
}

/* ---------- Player count for current league ---------- */

export async function getLeaguePlayerCount(leagueId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.leagueId, leagueId));
  return Number(rows[0]?.n ?? 0);
}

/* ---------- Resolve "me" ---------- */

export async function getPlayerById(playerId: string): Promise<Player | null> {
  const [row] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  return row ?? null;
}

export async function getFirstRosterPlayer(): Promise<Player | null> {
  // Prefer Craig Bradshaw as the demo dashboard — he has a meaningful
  // record so the preview shows real stats, not a 0-0 shell. Falls
  // back to alphabetical first if he's been removed.
  const [demo] = await db
    .select()
    .from(players)
    .where(
      and(eq(players.firstName, "Craig"), eq(players.lastName, "Bradshaw")),
    )
    .limit(1);
  if (demo) return demo;
  const [row] = await db
    .select()
    .from(players)
    .orderBy(asc(players.lastName))
    .limit(1);
  return row ?? null;
}

// Suppress unused-symbol warning when this file is imported as types-only.
export const __queryMarker = sql`/* queries */`;
