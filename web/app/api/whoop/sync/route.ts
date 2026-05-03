// POST /api/whoop/sync
// Triggers a full Whoop backfill for the signed-in player. Admins can
// pass `playerId` in the JSON body to backfill on behalf of another
// player (used for support / debugging). Idempotent — re-runs are safe
// thanks to the (player_id, whoop_workout_id) unique index.
//
// Response shape mirrors BackfillResult so the client can show
// "Imported N new sessions" toasts.

import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { backfillWhoopWorkouts } from "@/lib/whoop/backfill";

export const runtime = "nodejs";
// Long-running for first-time backfills; default 300s on Vercel is fine
// but we set it explicitly so it's not surprising on smaller plans.
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sign in required." },
      { status: 401 },
    );
  }

  let bodyPlayerId: string | null = null;
  try {
    const body = (await request.json().catch(() => null)) as
      | { playerId?: string }
      | null;
    bodyPlayerId = body?.playerId ?? null;
  } catch {
    bodyPlayerId = null;
  }

  // Default to the caller's own player. Admins may target another
  // player by passing playerId in the request body.
  const targetPlayerId = bodyPlayerId ?? session.playerId ?? null;
  if (!targetPlayerId) {
    return NextResponse.json(
      { ok: false, error: "No player to sync." },
      { status: 400 },
    );
  }
  const isSelf = session.playerId === targetPlayerId;
  if (!isSelf && !isAdminLike(session)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden." },
      { status: 403 },
    );
  }

  try {
    const result = await backfillWhoopWorkouts(targetPlayerId);
    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
    });
  } catch (err) {
    console.error("[whoop] sync threw", err);
    const message =
      err instanceof Error ? err.message : "Unknown sync error.";
    return NextResponse.json(
      { ok: false, error: `Backfill crashed: ${message}` },
      { status: 500 },
    );
  }
}
