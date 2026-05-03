// GET /api/whoop/auth
// Redirects the signed-in player to Whoop's OAuth authorization page.
// After the player grants access, Whoop redirects to /api/whoop/callback.

import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const SCOPES = "read:workout read:profile read:body_measurement offline";

export async function GET() {
  const session = await readSession();
  if (!session?.playerId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Whoop integration not configured." },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bdlpickup.com";
  const redirectUri = `${baseUrl}/api/whoop/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    // Pass the playerId as state so the callback knows which player to update.
    // This is safe because the code exchange also requires client_secret.
    state: session.playerId,
  });

  return NextResponse.redirect(`${WHOOP_AUTH_URL}?${params.toString()}`);
}
