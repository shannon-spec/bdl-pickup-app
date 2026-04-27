/**
 * Vercel Cron handler — runs every minute.
 *
 *   GET /api/cron/sweep-invites
 *
 * Authorization: Vercel Cron sends a header `authorization: Bearer
 * <CRON_SECRET>`. We require it for the production deployment;
 * locally you can hit the route without it for testing.
 */
import { NextResponse } from "next/server";
import { sweepInviteExpirations } from "@/lib/actions/game-invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await sweepInviteExpirations();
  return NextResponse.json({ ok: true, ...result });
}
