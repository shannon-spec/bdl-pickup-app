/**
 * Whoop backfill — pulls every basketball workout from Jan 1, 2026
 * forward via the Whoop developer API and upserts into whoop_workouts.
 *
 * The cutoff is intentional: BDL doesn't care about pre-2026 sessions
 * since the league rosters and game history all start in this season.
 *
 * Pagination follows the `next_token` cursor returned by Whoop until
 * we run out of records. Token refresh is handled inline so a stale
 * access token doesn't abort a long backfill.
 */
import { eq } from "drizzle-orm";
import { db, players, whoopWorkouts } from "@/lib/db";

const WHOOP_API = "https://api.prod.whoop.com";
const WHOOP_TOKEN_URL = `${WHOOP_API}/oauth/oauth2/token`;
const WORKOUT_LIST_PATH = "/developer/v2/activity/workout";

/** Cutoff for the backfill. Anything older than this is dropped on
 *  the floor — the league season started in 2026. */
const BACKFILL_START = "2026-01-01T00:00:00.000Z";

/** V2 returns a stable lowercased `sport_name` string. Filter on that
 *  rather than the integer sport_id, which has drifted between API
 *  versions and is not reliably documented for basketball. */
const BASKETBALL_SPORT_NAME = "basketball";

/** Hard cap on pages so a runaway loop can't pin the function for
 *  longer than the platform's invocation timeout. 50 pages * 25
 *  records = 1,250 workouts which is comfortably more than a single
 *  player can post in 12 months of basketball. */
const MAX_PAGES = 50;
const PAGE_LIMIT = 25;

type WhoopWorkoutResponse = {
  records?: Array<{
    id: string;
    sport_id: number;
    sport_name?: string;
    start: string;
    end: string;
    score_state: string;
    score?: {
      strain?: number;
      average_heart_rate?: number;
      max_heart_rate?: number;
      kilojoule?: number;
    };
  }>;
  next_token?: string | null;
};

export type BackfillResult =
  | {
      ok: true;
      pagesFetched: number;
      basketballSeen: number;
      inserted: number;
      lastSyncAt: Date;
    }
  | { ok: false; error: string };

async function refreshAccessToken(
  playerId: string,
  refreshToken: string,
): Promise<string | null> {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) return null;

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const expiry = new Date(Date.now() + tokens.expires_in * 1000);
  await db
    .update(players)
    .set({
      whoopAccessToken: tokens.access_token,
      whoopRefreshToken: tokens.refresh_token ?? refreshToken,
      whoopTokenExpiry: expiry,
    })
    .where(eq(players.id, playerId));
  return tokens.access_token;
}

/**
 * Pull every basketball workout for a player since BACKFILL_START and
 * upsert into whoop_workouts. Safe to call repeatedly — the unique
 * index on (player_id, whoop_workout_id) keeps re-runs idempotent.
 */
export async function backfillWhoopWorkouts(
  playerId: string,
): Promise<BackfillResult> {
  const [player] = await db
    .select({
      whoopAccessToken: players.whoopAccessToken,
      whoopRefreshToken: players.whoopRefreshToken,
      whoopTokenExpiry: players.whoopTokenExpiry,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player?.whoopAccessToken) {
    return { ok: false, error: "Whoop not connected for this player." };
  }

  // Refresh proactively when within 5 minutes of expiry; the long
  // backfill should not be interrupted by a mid-loop 401.
  let accessToken = player.whoopAccessToken;
  if (
    player.whoopRefreshToken &&
    player.whoopTokenExpiry &&
    new Date(player.whoopTokenExpiry).getTime() - Date.now() < 5 * 60 * 1000
  ) {
    const refreshed = await refreshAccessToken(
      playerId,
      player.whoopRefreshToken,
    );
    if (refreshed) accessToken = refreshed;
  }

  let nextToken: string | null = null;
  let pagesFetched = 0;
  let basketballSeen = 0;
  let inserted = 0;

  while (pagesFetched < MAX_PAGES) {
    const params = new URLSearchParams({
      limit: String(PAGE_LIMIT),
      start: BACKFILL_START,
    });
    if (nextToken) params.set("nextToken", nextToken);

    const url = `${WHOOP_API}${WORKOUT_LIST_PATH}?${params.toString()}`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // One-shot retry on 401 in case the token expired mid-backfill.
    if (res.status === 401 && player.whoopRefreshToken) {
      const refreshed = await refreshAccessToken(
        playerId,
        player.whoopRefreshToken,
      );
      if (refreshed) {
        accessToken = refreshed;
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `Whoop API ${res.status} on page ${pagesFetched + 1}`,
      };
    }

    const data = (await res.json()) as WhoopWorkoutResponse;
    const records = data.records ?? [];
    pagesFetched += 1;

    const basketball = records.filter(
      (w) => w.sport_name?.toLowerCase() === BASKETBALL_SPORT_NAME,
    );
    basketballSeen += basketball.length;

    if (basketball.length > 0) {
      const rows = basketball.map((w) => {
        const start = new Date(w.start);
        const end = new Date(w.end);
        return {
          playerId,
          whoopWorkoutId: String(w.id),
          date: start,
          durationMin: Math.max(
            0,
            Math.round((end.getTime() - start.getTime()) / 60000),
          ),
          strain:
            typeof w.score?.strain === "number"
              ? Math.round(w.score.strain * 10) / 10
              : null,
          avgHr: w.score?.average_heart_rate ?? null,
          maxHr: w.score?.max_heart_rate ?? null,
          calories:
            typeof w.score?.kilojoule === "number"
              ? Math.round(w.score.kilojoule * 0.239)
              : null,
          sportId: w.sport_id,
        };
      });

      const inserts = await db
        .insert(whoopWorkouts)
        .values(rows)
        .onConflictDoNothing({
          target: [
            whoopWorkouts.playerId,
            whoopWorkouts.whoopWorkoutId,
          ],
        })
        .returning({ id: whoopWorkouts.id });
      inserted += inserts.length;
    }

    nextToken = data.next_token ?? null;
    if (!nextToken) break;
  }

  const now = new Date();
  await db
    .update(players)
    .set({ whoopLastSyncAt: now })
    .where(eq(players.id, playerId));

  return {
    ok: true,
    pagesFetched,
    basketballSeen,
    inserted,
    lastSyncAt: now,
  };
}
