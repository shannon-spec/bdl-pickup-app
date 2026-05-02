"use server";

import { eq, and, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
  db,
  players,
  leaguePlayers,
  superAdmins,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import {
  isAdminLike,
  getMyCommissionerLeagueIds,
} from "@/lib/auth/perms";
import { requireManageView } from "@/lib/auth/view";

export type CredsResult =
  | { ok: true; data?: { username?: string } }
  | { ok: false; error: string };

/**
 * Returns true when the viewer is allowed to manage `playerId`'s
 * credentials: super admin always, commissioner only when the player
 * is a member of one of their leagues.
 */
async function canManagePlayerCreds(
  session: Awaited<ReturnType<typeof readSession>>,
  playerId: string,
): Promise<boolean> {
  if (!session) return false;
  if (isAdminLike(session)) return true;
  const myLeagues = await getMyCommissionerLeagueIds(session);
  if (myLeagues.length === 0) return false;
  const [hit] = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(
      and(
        eq(leaguePlayers.playerId, playerId),
        inArray(leaguePlayers.leagueId, myLeagues),
      ),
    )
    .limit(1);
  return !!hit;
}

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;
// Pragmatic email regex — same shape Zod's .email() accepts, just
// inlined to avoid pulling Zod for one check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function setPlayerCredentials(
  playerId: string,
  formData: FormData,
): Promise<CredsResult> {
  const session = await readSession();
  try {
    await requireManageView();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }
  if (!(await canManagePlayerCreds(session, playerId))) {
    return { ok: false, error: "Not authorized to manage this player." };
  }

  const usernameRaw = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!USERNAME_RE.test(usernameRaw)) {
    return {
      ok: false,
      error: "Username must be 3–40 chars, letters/numbers/. _ -",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  // Email is now required for any player with credentials. Without
  // one, the forgot-password flow can never reach them — which is
  // exactly the failure mode this guard exists to prevent.
  const [current] = await db
    .select({ email: players.email })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Player not found." };
  }
  const finalEmail = emailRaw || current.email || "";
  if (!finalEmail) {
    return {
      ok: false,
      error:
        "Email is required so the player can use Forgot Password. Add one to the player record or fill it here.",
    };
  }
  if (!EMAIL_RE.test(finalEmail)) {
    return { ok: false, error: "Email looks invalid." };
  }

  // Username uniqueness — across players AND super_admins so creds
  // can't shadow an existing admin login.
  const [conflict] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.username, usernameRaw), ne(players.id, playerId)))
    .limit(1);
  if (conflict) {
    return { ok: false, error: "That username is already taken." };
  }
  const [adminClash] = await db
    .select({ id: superAdmins.id })
    .from(superAdmins)
    .where(eq(superAdmins.username, usernameRaw))
    .limit(1);
  if (adminClash) {
    return { ok: false, error: "That username is reserved for an admin account." };
  }

  // Email uniqueness — enforced at DB level by players_email_uq, but
  // pre-check so we can return a friendly error instead of letting the
  // unique-violation bubble up as a 500.
  if (finalEmail !== current.email) {
    const [emailClash] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.email, finalEmail), ne(players.id, playerId)))
      .limit(1);
    if (emailClash) {
      return {
        ok: false,
        error: "That email is already on another player's account.",
      };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(players)
    .set({ username: usernameRaw, passwordHash, email: finalEmail })
    .where(eq(players.id, playerId));

  revalidatePath("/admin/credentials");
  revalidatePath(`/players/${playerId}`);
  return { ok: true, data: { username: usernameRaw } };
}

export async function clearPlayerCredentials(
  playerId: string,
): Promise<CredsResult> {
  const session = await readSession();
  try {
    await requireManageView();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }
  if (!(await canManagePlayerCreds(session, playerId))) {
    return { ok: false, error: "Not authorized to manage this player." };
  }
  await db
    .update(players)
    .set({ username: null, passwordHash: null })
    .where(eq(players.id, playerId));
  revalidatePath("/admin/credentials");
  revalidatePath(`/players/${playerId}`);
  return { ok: true };
}

