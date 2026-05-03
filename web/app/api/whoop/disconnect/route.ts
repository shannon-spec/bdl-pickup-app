// POST /api/whoop/disconnect
// Clears the Whoop tokens for the signed-in player, unlinking their account.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { db, players } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const session = await readSession();
  if (!session?.playerId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  await db
    .update(players)
    .set({
      whoopAccessToken: null,
      whoopRefreshToken: null,
      whoopTokenExpiry: null,
      whoopUserId: null,
    })
    .where(eq(players.id, session.playerId));

  return NextResponse.json({ ok: true });
}
