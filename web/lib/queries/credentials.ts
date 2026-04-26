import { asc, inArray } from "drizzle-orm";
import {
  db,
  players,
  leagues,
  leaguePlayers,
  leagueCommissioners,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { isAdminLike, getMyCommissionerLeagueIds } from "@/lib/auth/perms";

export type CredentialRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  username: string | null;
  hasPassword: boolean;
  isCommissioner: boolean;
  leagueNames: string[];
};

/**
 * Player set the viewer is allowed to assign creds to: every player
 * for super admin, league members for commissioners. Each row carries
 * the current credential state so the UI can render Set vs Reset
 * actions without a second roundtrip.
 *
 * Lives in /lib/queries (not in /lib/actions/credentials.ts) because
 * a "use server" file's exports are treated as RPC server actions —
 * fine for mutations, awkward for plain reads consumed by an RSC.
 */
export async function getCredentialPlayers(): Promise<{
  rows: CredentialRow[];
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
    .orderBy(asc(players.lastName), asc(players.firstName));

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
  const [memberships, commishRows] = await Promise.all([
    db
      .select({
        playerId: leaguePlayers.playerId,
        leagueId: leaguePlayers.leagueId,
      })
      .from(leaguePlayers)
      .where(inArray(leaguePlayers.playerId, ids)),
    db
      .select({
        playerId: leagueCommissioners.playerId,
        leagueId: leagueCommissioners.leagueId,
      })
      .from(leagueCommissioners)
      .where(inArray(leagueCommissioners.playerId, ids)),
  ]);

  // Resolve league names in one shot via drizzle's native inArray —
  // avoids hand-rolled SQL with array-cast pitfalls.
  const leagueIds = Array.from(
    new Set([
      ...memberships.map((m) => m.leagueId),
      ...commishRows.map((c) => c.leagueId),
    ]),
  );
  const leagueNameById = new Map<string, string>();
  if (leagueIds.length > 0) {
    const leagueRows = await db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .where(inArray(leagues.id, leagueIds));
    for (const r of leagueRows) leagueNameById.set(r.id, r.name);
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
