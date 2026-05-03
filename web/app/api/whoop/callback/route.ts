// GET /api/whoop/callback
// Handles the OAuth callback from Whoop. Exchanges the authorization code
// for tokens and stores them on the player row, then redirects back to
// the player's profile page.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, players } from "@/lib/db";
import { backfillWhoopWorkouts } from "@/lib/whoop/backfill";

export const runtime = "nodejs";

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // playerId passed through OAuth state
  const error = url.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bdlpickup.com";
  const redirectBase = state ? `${baseUrl}/players/${state}` : `${baseUrl}/players`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${redirectBase}?whoop=error`);
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${redirectBase}?whoop=error`);
  }

  const redirectUri = `${baseUrl}/api/whoop/callback`;

  try {
    // Exchange authorization code for access + refresh tokens
    const tokenRes = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Whoop token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${redirectBase}?whoop=error`);
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Fetch the Whoop user ID for display purposes
    const profileRes = await fetch(
      "https://api.prod.whoop.com/developer/v1/user/profile/basic",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    const whoopProfile = profileRes.ok
      ? (await profileRes.json() as { user_id?: number })
      : null;

    // Persist tokens on the player row
    await db
      .update(players)
      .set({
        whoopAccessToken: tokens.access_token,
        whoopRefreshToken: tokens.refresh_token ?? null,
        whoopTokenExpiry: expiry,
        whoopUserId: whoopProfile?.user_id ? String(whoopProfile.user_id) : null,
      })
      .where(eq(players.id, state));

    // Kick off the historical backfill in the background. We don't
    // await it — first-time syncs paginate through Whoop and can take
    // several seconds. The redirect happens immediately and the
    // profile shows results once the rows land.
    backfillWhoopWorkouts(state).catch((err) => {
      console.error("[whoop] post-connect backfill failed", err);
    });

    return NextResponse.redirect(`${redirectBase}?whoop=connected`);
  } catch (err) {
    console.error("Whoop callback error:", err);
    return NextResponse.redirect(`${redirectBase}?whoop=error`);
  }
}
