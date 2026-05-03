/**
 * Whoop backfill — pulls every workout AND every daily cycle since
 * Jan 1, 2026 via the Whoop developer API V2 and upserts into
 * whoop_workouts / whoop_cycles.
 *
 * We intentionally pull *all* workouts (not just basketball). BDL
 * pairs strain to its scheduled games by time-overlap, so the source
 * of truth is the BDL game window, not Whoop's user-applied sport
 * label. Day-strain (cycle) is the fallback when no workout overlaps.
 */
import { eq } from "drizzle-orm";
import { db, players, whoopCycles, whoopWorkouts } from "@/lib/db";

const WHOOP_API = "https://api.prod.whoop.com";
const WHOOP_TOKEN_URL = `${WHOOP_API}/oauth/oauth2/token`;
const WORKOUT_LIST_PATH = "/developer/v2/activity/workout";
const CYCLE_LIST_PATH = "/developer/v2/cycle";

const BACKFILL_START = "2026-01-01T00:00:00.000Z";
const MAX_PAGES = 50;
const PAGE_LIMIT = 25;
/** Cap on rows per INSERT — Postgres has a ~65k parameter limit and
 *  the Neon HTTP body is bounded too. 50 rows × ~10 cols stays well
 *  under either ceiling. */
const INSERT_CHUNK = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type WhoopWorkoutRecord = {
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
};

type WhoopCycleRecord = {
  id: number | string;
  start: string;
  end?: string | null;
  score_state: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
};

type WhoopPaged<T> = {
  records?: T[];
  next_token?: string | null;
};

export type BackfillResult =
  | {
      ok: true;
      pagesFetched: number;
      workoutsInserted: number;
      cyclesInserted: number;
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

async function fetchAllPages<T>(
  basePath: string,
  accessToken: string,
  refreshFn: () => Promise<string | null>,
): Promise<{ records: T[]; pages: number } | { error: string }> {
  let nextToken: string | null = null;
  let pages = 0;
  let token = accessToken;
  const out: T[] = [];

  while (pages < MAX_PAGES) {
    const params = new URLSearchParams({
      limit: String(PAGE_LIMIT),
      start: BACKFILL_START,
    });
    if (nextToken) params.set("nextToken", nextToken);

    const url = `${WHOOP_API}${basePath}?${params.toString()}`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      const refreshed = await refreshFn();
      if (refreshed) {
        token = refreshed;
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    if (!res.ok) {
      return { error: `Whoop ${basePath} ${res.status} on page ${pages + 1}` };
    }

    const data = (await res.json()) as WhoopPaged<T>;
    out.push(...(data.records ?? []));
    pages += 1;
    nextToken = data.next_token ?? null;
    if (!nextToken) break;
  }

  return { records: out, pages };
}

function localDate(iso: string): string {
  // YYYY-MM-DD slice — Whoop's start/end are ISO with timezone offset
  // and the "day" of a cycle is its end date. Use UTC-stable slice.
  return iso.slice(0, 10);
}

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

  const refreshFn = async (): Promise<string | null> => {
    if (!player.whoopRefreshToken) return null;
    const fresh = await refreshAccessToken(playerId, player.whoopRefreshToken);
    if (fresh) accessToken = fresh;
    return fresh;
  };

  const workoutPages = await fetchAllPages<WhoopWorkoutRecord>(
    WORKOUT_LIST_PATH,
    accessToken,
    refreshFn,
  );
  if ("error" in workoutPages) return { ok: false, error: workoutPages.error };

  // Cycles are best-effort: if the access token was issued before we
  // added read:cycles scope, the endpoint will 401. Don't lose the
  // workouts we already fetched — fall through with an empty array
  // and let the player reconnect to grant the new scope.
  const cyclePages = await fetchAllPages<WhoopCycleRecord>(
    CYCLE_LIST_PATH,
    accessToken,
    refreshFn,
  );
  const cycleRecords =
    "error" in cyclePages ? [] : cyclePages.records;
  const cyclePagesFetched = "error" in cyclePages ? 0 : cyclePages.pages;
  const cycleError = "error" in cyclePages ? cyclePages.error : null;
  if (cycleError) {
    console.warn(`[whoop] cycle backfill skipped: ${cycleError}`);
  }

  let workoutsInserted = 0;
  if (workoutPages.records.length > 0) {
    const rows = workoutPages.records
      .filter((w) => !!w.start && !isNaN(new Date(w.start).getTime()))
      .map((w) => {
        const start = new Date(w.start);
        const end = w.end ? new Date(w.end) : null;
        const validEnd = end && !isNaN(end.getTime()) ? end : null;
        return {
          playerId,
          whoopWorkoutId: String(w.id),
          date: start,
          endDate: validEnd,
          durationMin: validEnd
            ? Math.max(
                0,
                Math.round((validEnd.getTime() - start.getTime()) / 60000),
              )
            : null,
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
          sportId: w.sport_id ?? null,
          sportName: w.sport_name ?? null,
        };
      });
    for (const batch of chunk(rows, INSERT_CHUNK)) {
      const inserts = await db
        .insert(whoopWorkouts)
        .values(batch)
        .onConflictDoNothing({
          target: [whoopWorkouts.playerId, whoopWorkouts.whoopWorkoutId],
        })
        .returning({ id: whoopWorkouts.id });
      workoutsInserted += inserts.length;
    }
  }

  let cyclesInserted = 0;
  if (cycleRecords.length > 0) {
    const rows = cycleRecords.map((c) => {
      const start = new Date(c.start);
      const end = c.end ? new Date(c.end) : null;
      // The cycle's "day" is the calendar date it ended (or started, if
      // still in progress). This aligns with how BDL game dates are set.
      const dayIso = end ? c.end! : c.start;
      return {
        playerId,
        whoopCycleId: String(c.id),
        date: localDate(dayIso),
        cycleStart: start,
        cycleEnd: end,
        dayStrain:
          typeof c.score?.strain === "number"
            ? Math.round(c.score.strain * 10) / 10
            : null,
        avgHr: c.score?.average_heart_rate ?? null,
        maxHr: c.score?.max_heart_rate ?? null,
        calories:
          typeof c.score?.kilojoule === "number"
            ? Math.round(c.score.kilojoule * 0.239)
            : null,
      };
    });
    for (const batch of chunk(rows, INSERT_CHUNK)) {
      const inserts = await db
        .insert(whoopCycles)
        .values(batch)
        .onConflictDoNothing({
          target: [whoopCycles.playerId, whoopCycles.whoopCycleId],
        })
        .returning({ id: whoopCycles.id });
      cyclesInserted += inserts.length;
    }
  }

  const now = new Date();
  await db
    .update(players)
    .set({ whoopLastSyncAt: now })
    .where(eq(players.id, playerId));

  return {
    ok: true,
    pagesFetched: workoutPages.pages + cyclePagesFetched,
    workoutsInserted,
    cyclesInserted,
    lastSyncAt: now,
  };
}
