/**
 * BDL initial seed — ports the legacy localStorage seed into Neon
 * and populates per-game rosters so the dashboard's player stats
 * have real data to compute on.
 *
 * Idempotent: clears all tables in FK-safe order, then inserts:
 *   - 28 roster players
 *   - 1 CPA League
 *   - 28 league_players rows linking all players to CPA League
 *   - 30 completed games from the 2026 game log
 *   - ~300 game_roster rows (5 A + 5 B per game) with the recorded
 *     game winner placed on the winning team
 *   - 2 super admins (admin + shannon), both linked to Shannon Terry
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  players,
  leagues,
  leaguePlayers,
  games,
  gameRoster,
  superAdmins,
  invites,
  leagueCommissioners,
} from "../lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Run `npm run db:pull-env` first.");
  process.exit(1);
}

const sql = neon(url);
const db = drizzle(sql);

const ROSTER_NAMES: { firstName: string; lastName: string }[] = [
  { firstName: "Braxton", lastName: "Bonds" },
  { firstName: "Brian", lastName: "Hemping" },
  { firstName: "Brody", lastName: "Peebles" },
  { firstName: "Bryce", lastName: "McCormick" },
  { firstName: "Canon", lastName: "Jackson" },
  { firstName: "Chris", lastName: "Meriwether" },
  { firstName: "Clay", lastName: "Washburn" },
  { firstName: "Clinton", lastName: "Corder" },
  { firstName: "Craig", lastName: "Bradshaw" },
  { firstName: "Craiger", lastName: "Eshleman" },
  { firstName: "DJ", lastName: "Wootson" },
  { firstName: "Drew", lastName: "Maddux" },
  { firstName: "Drew", lastName: "Scott" },
  { firstName: "Greg", lastName: "Lorenzi" },
  { firstName: "Jake", lastName: "Allsmiller" },
  { firstName: "Jay", lastName: "Cutler" },
  { firstName: "Jeremiah", lastName: "Oatsvall" },
  { firstName: "Joe", lastName: "Neuzil" },
  { firstName: "Joey", lastName: "Dickson" },
  { firstName: "Joey", lastName: "Skibbie" },
  { firstName: "Josh", lastName: "Slater" },
  { firstName: "Keenan", lastName: "Streitmatter" },
  { firstName: "Michael", lastName: "Mayernick" },
  { firstName: "RA", lastName: "Dickey" },
  { firstName: "Ryan", lastName: "Mullins" },
  { firstName: "Shannon", lastName: "Terry" },
  { firstName: "Titus", lastName: "Wootson" },
  { firstName: "Tyler", lastName: "Pennington" },
];

const GAME_LOG_2026: { d: string; sA: number; sB: number; gw: string }[] = [
  { d: "2026-01-02", sA: 138, sB: 151, gw: "dj" },
  { d: "2026-01-05", sA: 150, sB: 137, gw: "jake" },
  { d: "2026-01-07", sA: 150, sB: 131, gw: "jake" },
  { d: "2026-01-09", sA: 150, sB: 132, gw: "jake" },
  { d: "2026-01-14", sA: 146, sB: 151, gw: "dj" },
  { d: "2026-01-16", sA: 150, sB: 128, gw: "craig" },
  { d: "2026-01-19", sA: 139, sB: 150, gw: "dj" },
  { d: "2026-01-21", sA: 150, sB: 139, gw: "brian" },
  { d: "2026-01-23", sA: 152, sB: 143, gw: "jake" },
  { d: "2026-01-30", sA: 140, sB: 117, gw: "shannon" },
  { d: "2026-02-02", sA: 150, sB: 129, gw: "shawn" },
  { d: "2026-02-04", sA: 152, sB: 135, gw: "shannon" },
  { d: "2026-02-06", sA: 151, sB: 143, gw: "brody" },
  { d: "2026-02-09", sA: 150, sB: 148, gw: "drew" },
  { d: "2026-02-10", sA: 150, sB: 120, gw: "drew" },
  { d: "2026-02-13", sA: 144, sB: 151, gw: "canon" },
  { d: "2026-02-16", sA: 151, sB: 147, gw: "brody" },
  { d: "2026-02-18", sA: 150, sB: 147, gw: "greg" },
  { d: "2026-02-20", sA: 132, sB: 150, gw: "ra" },
  { d: "2026-02-23", sA: 144, sB: 150, gw: "shawn" },
  { d: "2026-02-25", sA: 150, sB: 143, gw: "brody" },
  { d: "2026-02-27", sA: 132, sB: 150, gw: "dj" },
  { d: "2026-03-02", sA: 149, sB: 150, gw: "dj" },
  { d: "2026-03-04", sA: 143, sB: 150, gw: "joe" },
  { d: "2026-03-06", sA: 151, sB: 135, gw: "jake" },
  { d: "2026-03-09", sA: 151, sB: 141, gw: "shannon" },
  { d: "2026-03-11", sA: 150, sB: 138, gw: "jay" },
  { d: "2026-03-13", sA: 148, sB: 150, gw: "ra" },
  { d: "2026-03-16", sA: 142, sB: 150, gw: "dj" },
];

/* Deterministic PRNG so reseeds produce identical rosters. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function main() {
  console.log("Clearing existing data…");
  await db.delete(invites);
  await db.delete(gameRoster);
  await db.delete(games);
  await db.delete(leagueCommissioners);
  await db.delete(leaguePlayers);
  await db.delete(superAdmins);
  await db.delete(players);

  console.log(`Inserting ${ROSTER_NAMES.length} players…`);
  const insertedPlayers = await db
    .insert(players)
    .values(ROSTER_NAMES.map((n) => ({ ...n })))
    .returning({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    });

  const byFirstName = new Map<string, string>();
  for (const p of insertedPlayers) byFirstName.set(p.firstName.toLowerCase(), p.id);
  const shannonId = insertedPlayers.find(
    (p) => p.firstName === "Shannon" && p.lastName === "Terry",
  )!.id;
  byFirstName.set("shawn", shannonId); // legacy nickname

  console.log("Inserting CPA League…");
  const [cpa] = await db
    .insert(leagues)
    .values({
      name: "CPA League",
      season: "2026",
      format: "5v5",
      schedule: "Tuesdays & Thursdays · 7:00 PM",
      startTime: "12:00:00",
      startTimeType: "fixed",
      days: [1, 3, 5],
      teamAName: "White",
      teamBName: "Dark",
    })
    .returning({ id: leagues.id, name: leagues.name });

  console.log(`Linking ${insertedPlayers.length} players to CPA League…`);
  await db
    .insert(leaguePlayers)
    .values(insertedPlayers.map((p) => ({ leagueId: cpa.id, playerId: p.id })));

  console.log(`Inserting ${GAME_LOG_2026.length} games…`);
  const insertedGames = await db
    .insert(games)
    .values(
      GAME_LOG_2026.map((g) => {
        const gwId = g.gw ? byFirstName.get(g.gw) ?? null : null;
        const winTeam =
          g.sA > g.sB ? ("A" as const) : g.sB > g.sA ? ("B" as const) : ("Tie" as const);
        return {
          leagueId: cpa.id,
          leagueName: cpa.name,
          teamAName: "White",
          teamBName: "Dark",
          format: "5v5" as const,
          numInvites: 0,
          gameDate: g.d,
          gameTime: "12:00:00",
          scoreA: g.sA,
          scoreB: g.sB,
          winTeam,
          locked: true,
          gameWinner: gwId,
        };
      }),
    )
    .returning({
      id: games.id,
      gameDate: games.gameDate,
      winTeam: games.winTeam,
      gameWinner: games.gameWinner,
    });

  console.log("Generating game rosters…");
  // Roster rule: every game has 10 players (5 A + 5 B). Shannon is in ~85%
  // of games (sits 4 of 30). The recorded game winner always plays on the
  // winning team. Remaining slots filled by a deterministic shuffle
  // seeded by date so reseeds produce identical rosters.
  const SHANNON_OFF = new Set(["2026-02-09", "2026-02-23", "2026-03-11"]);

  type RosterRow = { gameId: string; playerId: string; side: "A" | "B" | "invited" };
  const rosterRows: RosterRow[] = [];

  for (const g of insertedGames) {
    if (!g.gameDate) continue;
    const seed = parseInt(g.gameDate.replace(/-/g, ""), 10);
    const all = insertedPlayers.map((p) => p.id);
    const winnerId = g.gameWinner;
    const shannonHere = !SHANNON_OFF.has(g.gameDate);

    // Build attendees: winner first (if any), Shannon second (if attending),
    // then fill from a deterministic shuffle of the remaining roster.
    const attendees: string[] = [];
    if (winnerId) attendees.push(winnerId);
    if (shannonHere && !attendees.includes(shannonId)) attendees.push(shannonId);
    for (const id of shuffleSeeded(all, seed)) {
      if (attendees.length >= 10) break;
      if (!attendees.includes(id)) attendees.push(id);
    }

    const winSide = g.winTeam === "A" || g.winTeam === "B" ? g.winTeam : "A";
    const loseSide: "A" | "B" = winSide === "A" ? "B" : "A";

    let aCount = 0;
    let bCount = 0;
    const assigned: { playerId: string; side: "A" | "B" }[] = [];

    if (winnerId) {
      assigned.push({ playerId: winnerId, side: winSide });
      if (winSide === "A") aCount++;
      else bCount++;
    }

    // Distribute remaining attendees evenly across the two sides.
    // Shannon and everyone else use the same balance rule — no bias toward
    // the winning team — so her record reflects whichever side she landed
    // on game-by-game.
    for (const id of attendees) {
      if (winnerId && id === winnerId) continue;
      let side: "A" | "B";
      if (aCount >= 5) side = "B";
      else if (bCount >= 5) side = "A";
      else side = aCount <= bCount ? "A" : "B";
      assigned.push({ playerId: id, side });
      if (side === "A") aCount++;
      else bCount++;
    }

    for (const a of assigned) {
      rosterRows.push({ gameId: g.id, playerId: a.playerId, side: a.side });
    }
    void loseSide; // referenced for clarity above
  }

  console.log(`Inserting ${rosterRows.length} game_roster rows…`);
  // Chunk inserts to keep payloads small.
  for (let i = 0; i < rosterRows.length; i += 200) {
    await db.insert(gameRoster).values(rosterRows.slice(i, i + 200));
  }

  console.log("Seeding super admins…");
  await db.insert(superAdmins).values([
    {
      username: "admin",
      role: "owner",
      firstName: "Shannon",
      lastName: "Terry",
      playerId: shannonId,
    },
    {
      username: "shannon",
      role: "owner",
      firstName: "Shannon",
      lastName: "Terry",
      playerId: shannonId,
    },
  ]);

  console.log("✓ Seed complete.");
  console.log(`  players: ${insertedPlayers.length}`);
  console.log(`  leagues: 1 (CPA League)`);
  console.log(`  league_players: ${insertedPlayers.length}`);
  console.log(`  games: ${insertedGames.length}`);
  console.log(`  game_roster: ${rosterRows.length}`);
  console.log(`  super_admins: 2 (admin, shannon)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
