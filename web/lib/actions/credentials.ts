"use server";

import { eq, and, inArray, ne, sql as dsql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
  db,
  players,
  leaguePlayers,
  leagueCommissioners,
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
  if (!USERNAME_RE.test(usernameRaw)) {
    return {
      ok: false,
      error: "Username must be 3–40 chars, letters/numbers/. _ -",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
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
  // Cross-check super_admins via raw SQL — schema is in scope.
  const adminClash = await db.execute(
    dsql`SELECT 1 FROM super_admins WHERE username = ${usernameRaw} LIMIT 1`,
  );
  if (adminClash.rows && adminClash.rows.length > 0) {
    return { ok: false, error: "That username is reserved for an admin account." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(players)
    .set({ username: usernameRaw, passwordHash })
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

/**
 * Returns the player set the viewer is allowed to assign creds to:
 * all players for super admin, league members for commissioners.
 * Each row carries the current credential state so the UI can render
 * "Set" vs "Reset" actions without a second roundtrip.
 */
export async function getCredentialPlayers(): Promise<{
  rows: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    username: string | null;
    hasPassword: boolean;
    isCommissioner: boolean;
    leagueNames: string[];
  }[];
  scope: "admin" | "commissioner" | "none";
}> {
  const session = await readSession();
  if (!session) return { rows: [], scope: "none" };

  let allowedPlayerIds: Set<string> | null = null; // null = all (admin)
  if (!isAdminLike(session)) {
    const myLeagues = await getMyCommissionerLeagueIds(session);
    if (myLeagues.length === 0) return { rows: [], scope: "none" };
    const memberRows = await db
      .select({ playerId: leaguePlayers.playerId })
      .from(leaguePlayers)
      .where(inArray(leaguePlayers.leagueId, myLeagues));
    allowedPlayerIds = new Set(memberRows.map((m) => m.playerId));
  }

  // Single query for player details + their league memberships +
  // commissioner flag. We aggregate league names client-side to keep
  // the SQL portable.
  const playerRows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      email: players.email,
      username: players.username,
      passwordHash: players.passwordHash,
    })
    .from(players)
    .orderBy(players.lastName, players.firstName);

  const filtered = allowedPlayerIds
    ? playerRows.filter((p) => allowedPlayerIds!.has(p.id))
    : playerRows;
  if (filtered.length === 0) {
    return {
      rows: [],
      scope: isAdminLike(session) ? "admin" : "commissioner",
    };
  }

  const ids = filtered.map((p) => p.id);
  const memberships = await db
    .select({
      playerId: leaguePlayers.playerId,
      leagueId: leaguePlayers.leagueId,
    })
    .from(leaguePlayers)
    .where(inArray(leaguePlayers.playerId, ids));
  const commishRows = await db
    .select({
      playerId: leagueCommissioners.playerId,
      leagueId: leagueCommissioners.leagueId,
    })
    .from(leagueCommissioners)
    .where(inArray(leagueCommissioners.playerId, ids));

  // Resolve league names in one shot
  const leagueIdSet = new Set([
    ...memberships.map((m) => m.leagueId),
    ...commishRows.map((c) => c.leagueId),
  ]);
  const leaguesArr = leagueIdSet.size
    ? await db.execute(
        dsql`SELECT id, name FROM leagues WHERE id = ANY(${Array.from(leagueIdSet)}::uuid[])`,
      )
    : { rows: [] };
  const leagueNameById = new Map<string, string>();
  for (const r of (leaguesArr.rows ?? []) as Array<{ id: string; name: string }>) {
    leagueNameById.set(r.id, r.name);
  }

  const memberLeaguesByPlayer = new Map<string, string[]>();
  for (const m of memberships) {
    const arr = memberLeaguesByPlayer.get(m.playerId) ?? [];
    const name = leagueNameById.get(m.leagueId);
    if (name) arr.push(name);
    memberLeaguesByPlayer.set(m.playerId, arr);
  }
  const commishSet = new Set(commishRows.map((c) => c.playerId));

  return {
    rows: filtered.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      username: p.username,
      hasPassword: !!p.passwordHash,
      isCommissioner: commishSet.has(p.id),
      leagueNames: memberLeaguesByPlayer.get(p.id) ?? [],
    })),
    scope: isAdminLike(session) ? "admin" : "commissioner",
  };
}
