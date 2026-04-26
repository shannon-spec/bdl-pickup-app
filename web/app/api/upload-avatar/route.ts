// POST /api/upload-avatar
// Uploads an image to Vercel Blob and writes the public URL to
// players.avatar_url for the target player.
//
// Required env (Vercel auto-injects when Blob is connected to project):
//   BLOB_READ_WRITE_TOKEN
//
// Authorization:
//   - The signed-in player can update their own avatar.
//   - Admin-like sessions can update any player.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { db, players } from "@/lib/db";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const targetId = String(form.get("playerId") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  // Auth: self or admin.
  const admin = isAdminLike(session);
  const isSelf = session.playerId === targetId;
  if (!admin && !isSelf) {
    return NextResponse.json(
      { error: "You can only update your own avatar." },
      { status: 403 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image must be under ${MAX_BYTES / (1024 * 1024)} MB.` },
      { status: 400 },
    );
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WEBP, or GIF image." },
      { status: 400 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Avatar storage not configured. Connect a Blob store in Vercel and pull env.",
      },
      { status: 500 },
    );
  }

  // Look up the target player + their current avatar so we can clean up.
  const [target] = await db
    .select({ id: players.id, avatarUrl: players.avatarUrl })
    .from(players)
    .where(eq(players.id, targetId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const key = `avatars/${target.id}-${Date.now()}.${ext?.toLowerCase()}`;

  const blob = await put(key, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });

  await db
    .update(players)
    .set({ avatarUrl: blob.url })
    .where(eq(players.id, target.id));

  // Best-effort cleanup of the previous avatar — non-fatal if it fails.
  if (target.avatarUrl && target.avatarUrl !== blob.url) {
    void del(target.avatarUrl).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, url: blob.url });
}

export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetId = url.searchParams.get("playerId") ?? "";
  if (!targetId) {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  const admin = isAdminLike(session);
  const isSelf = session.playerId === targetId;
  if (!admin && !isSelf) {
    return NextResponse.json(
      { error: "You can only update your own avatar." },
      { status: 403 },
    );
  }

  const [target] = await db
    .select({ id: players.id, avatarUrl: players.avatarUrl })
    .from(players)
    .where(eq(players.id, targetId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  if (target.avatarUrl) {
    void del(target.avatarUrl).catch(() => undefined);
  }
  await db
    .update(players)
    .set({ avatarUrl: null })
    .where(eq(players.id, target.id));

  return NextResponse.json({ ok: true });
}
