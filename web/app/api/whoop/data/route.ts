// GET /api/whoop/data?playerId=xxx
// Returns the player's recent basketball workouts from Whoop.
// Only the player themselves (or an admin) can fetch their data.
// Handles token refresh automatically when the access token is near expiry.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { db, players } from "@/lib/db";

export const runtime = "nodejs";

// Whoop V2 sport IDs — verify at developer.whoop.com/docs/developing/data-types/activity
// Log a basketball workout in the Whoop app and check the sport_id to confirm.
const BASKETBALL_SPORT_ID = 0;

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

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

  const tokens = await res.json() as {
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

type WhoopWorkout = {
  id: number;
  sport_id: number;
  start: string;
  end: string;
  score_state: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    kilojoule?: number;
    percent_recorded?: number;
    zone_duration?: {
      zone_zero_milli?: number;
      zone_one_milli?: number;
      zone_two_milli?: number;
      zone_three_milli?: number;
      zone_four_milli?: number;
      zone_five_milli?: number;
    };
  };
};

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  // Only self or admin can view Whoop data
  const isSelf = session.playerId === playerId;
  const admin = isAdminLike(session);
  if (!isSelf && !admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [player] = await db
    .select({
      id: players.id,
      whoopAccessToken: players.whoopAccessToken,
      whoopRefreshToken: players.whoopRefreshToken,
      whoopTokenExpiry: players.whoopTokenExpiry,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player?.whoopAccessToken) {
    return NextResponse.json({ connected: false, workouts: [] });
  }

  // Auto-refresh if within 5 minutes of expiry
  let accessToken = player.whoopAccessToken;
  if (
    player.whoopRefreshToken &&
    player.whoopTokenExpiry &&
    new Date(player.whoopTokenExpiry).getTime() - Date.now() < 5 * 60 * 1000
  ) {
    accessToken =
      (await refreshAccessToken(playerId, player.whoopRefreshToken)) ??
      accessToken;
  }

  // Fetch last 25 workouts — filter to basketball client-side
  const workoutsRes = await fetch(
    "https://api.prod.whoop.com/developer/v1/activity/workout?limit=25",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!workoutsRes.ok) {
    return NextResponse.json({
      connected: true,
      workouts: [],
      fetchError: true,
    });
  }

  const data = await workoutsRes.json() as { records?: WhoopWorkout[] };
  const allWorkouts = data.records ?? [];

  // Filter to basketball workouts only
  // NOTE: If sport_id 0 doesn't match your workouts, log a basketball
  // session and check the returned sport_id, then update BASKETBALL_SPORT_ID above.
  const basketball = allWorkouts.filter(
    (w) => w.sport_id === BASKETBALL_SPORT_ID && w.score_state === "SCORED",
  );

  return NextResponse.json({
    connected: true,
    workouts: basketball.map((w) => ({
      id: w.id,
      date: w.start,
      durationMin: Math.round(
        (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000,
      ),
      strain: w.score?.strain ? Math.round(w.score.strain * 10) / 10 : null,
      avgHr: w.score?.average_heart_rate ?? null,
      maxHr: w.score?.max_heart_rate ?? null,
      calories: w.score?.kilojoule
        ? Math.round(w.score.kilojoule * 0.239)
        : null,
    })),
  });
}
