import { asc, eq } from "drizzle-orm";
import { db, games, gameRoster, players } from "@/lib/db";

type Tone = "neutral" | "brand" | "win" | "loss" | "warn" | "info";

export type ActivityEvent = {
  id: string;
  date: string;
  href: string;
  text: string;
  pill: { tone: Tone; label: string; dot?: boolean };
  // Sort key embeds gameDate, time, id, and event subtype so events from
  // the same game still order deterministically. Sorted desc for display.
  sortKey: string;
};

const STREAK_TIERS = new Set([3, 5, 10]);
const GAMES_MILESTONE = 10;

type GameRow = typeof games.$inferSelect;

function isComplete(g: Pick<GameRow, "scoreA" | "scoreB" | "winTeam">) {
  return (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;
}

function deriveWin(
  g: Pick<GameRow, "scoreA" | "scoreB" | "winTeam">,
): "A" | "B" | "Tie" | null {
  if (g.winTeam) return g.winTeam;
  if (g.scoreA !== null && g.scoreB !== null) {
    if (g.scoreA > g.scoreB) return "A";
    if (g.scoreB > g.scoreA) return "B";
    return "Tie";
  }
  return null;
}

/**
 * Derives a chronological feed of activity events from games + roster.
 *
 * Three event categories:
 *   - Result / Upcoming  — one per game (existing behaviour).
 *   - Game Winner award  — when game.gameWinner is set.
 *   - Per-player streaks — W3/W5/W10 + L3/L5/L10 + snaps of streaks ≥3.
 *   - Career milestones  — every 10th game played.
 *
 * Streaks and milestones are computed by walking each player's games in
 * chronological order, so the events fire on the actual game where the
 * threshold was crossed (not on every render). All events go into one
 * flat list sorted desc.
 */
export async function getActivityEvents(): Promise<ActivityEvent[]> {
  const allGames = await db
    .select()
    .from(games)
    .orderBy(asc(games.gameDate), asc(games.gameTime), asc(games.id));

  // Roster joined with player names — one query for the whole feed.
  const rosterRows = await db
    .select({
      gameId: gameRoster.gameId,
      playerId: gameRoster.playerId,
      side: gameRoster.side,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(gameRoster)
    .innerJoin(players, eq(players.id, gameRoster.playerId));

  const rosterByGame = new Map<
    string,
    Array<{
      playerId: string;
      side: "A" | "B" | "invited";
      firstName: string;
      lastName: string;
    }>
  >();
  for (const r of rosterRows) {
    const arr = rosterByGame.get(r.gameId) ?? [];
    arr.push({
      playerId: r.playerId,
      side: r.side,
      firstName: r.firstName,
      lastName: r.lastName,
    });
    rosterByGame.set(r.gameId, arr);
  }

  // Player-name lookup for Game Winner events (winner may not be in the
  // roster of *this* game in pickup, so a separate index is safer).
  const allPlayers = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players);
  const nameById = new Map(
    allPlayers.map((p) => [p.id, `${p.firstName} ${p.lastName}`]),
  );

  const events: ActivityEvent[] = [];
  const stats = new Map<string, { games: number; streak: number }>();

  const dt = (g: GameRow, suffix: string) =>
    `${g.gameDate}:${g.gameTime ?? ""}:${g.id}:${suffix}`;

  for (const g of allGames) {
    if (!g.gameDate) continue;
    const completed = isComplete(g);
    const win = deriveWin(g);

    // ---- Result / Scheduled ----
    if (completed) {
      if (win && win !== "Tie") {
        const winnerTeam =
          win === "A" ? g.teamAName ?? "White" : g.teamBName ?? "Dark";
        const loserTeam =
          win === "A" ? g.teamBName ?? "Dark" : g.teamAName ?? "White";
        const winnerScore = win === "A" ? g.scoreA : g.scoreB;
        const loserScore = win === "A" ? g.scoreB : g.scoreA;
        events.push({
          id: `r:${g.id}`,
          date: g.gameDate,
          href: `/games/${g.id}`,
          text: `${winnerTeam} beat ${loserTeam} ${winnerScore ?? "?"}–${loserScore ?? "?"}${g.leagueName ? ` · ${g.leagueName}` : ""}`,
          pill: { tone: "win", label: "Final", dot: true },
          sortKey: dt(g, "0_r"),
        });
      }
    } else {
      events.push({
        id: `s:${g.id}`,
        date: g.gameDate,
        href: `/games/${g.id}`,
        text: `${g.teamAName ?? "White"} vs ${g.teamBName ?? "Dark"} scheduled${g.leagueName ? ` · ${g.leagueName}` : ""}`,
        pill: { tone: "neutral", label: "Upcoming" },
        sortKey: dt(g, "0_s"),
      });
      continue;
    }

    if (!completed || !win || win === "Tie") continue;

    // ---- Game Winner award ----
    if (g.gameWinner) {
      const heroName = nameById.get(g.gameWinner);
      if (heroName) {
        events.push({
          id: `gw:${g.id}`,
          date: g.gameDate,
          href: `/players/${g.gameWinner}`,
          text: `${heroName} named Game Winner${g.leagueName ? ` · ${g.leagueName}` : ""}`,
          pill: { tone: "brand", label: "Game Winner" },
          sortKey: dt(g, "1_gw"),
        });
      }
    }

    // ---- Per-player streak + milestone ----
    const inGame = rosterByGame.get(g.id) ?? [];
    for (const p of inGame) {
      if (p.side !== "A" && p.side !== "B") continue;
      const cur = stats.get(p.playerId) ?? { games: 0, streak: 0 };
      const won = p.side === win;
      const prevStreak = cur.streak;
      const snapped =
        (won && prevStreak <= -3) || (!won && prevStreak >= 3);

      cur.streak = won
        ? prevStreak >= 0
          ? prevStreak + 1
          : 1
        : prevStreak <= 0
          ? prevStreak - 1
          : -1;
      cur.games += 1;
      stats.set(p.playerId, cur);

      const fullName = `${p.firstName} ${p.lastName}`;
      const absStreak = Math.abs(cur.streak);
      const winStreak = cur.streak > 0;

      if (STREAK_TIERS.has(absStreak)) {
        events.push({
          id: `st:${g.id}:${p.playerId}`,
          date: g.gameDate,
          href: `/players/${p.playerId}`,
          text: `${fullName} on a ${absStreak}-game ${winStreak ? "winning" : "losing"} streak${g.leagueName ? ` · ${g.leagueName}` : ""}`,
          pill: {
            tone: winStreak ? "win" : "loss",
            label: `${winStreak ? "W" : "L"}${absStreak}`,
          },
          sortKey: dt(g, `2_st:${p.playerId}`),
        });
      }

      if (snapped) {
        const kind = prevStreak > 0 ? "winning" : "losing";
        events.push({
          id: `sn:${g.id}:${p.playerId}`,
          date: g.gameDate,
          href: `/players/${p.playerId}`,
          text: `${fullName}'s ${Math.abs(prevStreak)}-game ${kind} streak ended${g.leagueName ? ` · ${g.leagueName}` : ""}`,
          pill: { tone: "neutral", label: "Snapped" },
          sortKey: dt(g, `3_sn:${p.playerId}`),
        });
      }

      if (cur.games > 0 && cur.games % GAMES_MILESTONE === 0) {
        events.push({
          id: `ms:${g.id}:${p.playerId}`,
          date: g.gameDate,
          href: `/players/${p.playerId}`,
          text: `${fullName} hit ${cur.games} career games${g.leagueName ? ` · ${g.leagueName}` : ""}`,
          pill: { tone: "brand", label: `${cur.games} GP` },
          sortKey: dt(g, `4_ms:${p.playerId}`),
        });
      }
    }
  }

  events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return events;
}
