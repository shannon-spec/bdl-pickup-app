import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  joinRequests,
  players,
  leagues,
  teams,
  tournaments,
  communities,
} from "@/lib/db";
import { managedContextIds } from "@/lib/actions/join";
import type { Session } from "@/lib/auth/session";

export type JoinStatus = "pending" | "accepted" | "denied" | "hold";

/** Latest request status per context for a player (keyed "TYPE:id"). */
export async function getMyJoinStatuses(
  playerId: string,
): Promise<Map<string, JoinStatus>> {
  const rows = await db
    .select({
      type: joinRequests.contextType,
      id: joinRequests.contextId,
      status: joinRequests.status,
    })
    .from(joinRequests)
    .where(eq(joinRequests.playerId, playerId))
    .orderBy(desc(joinRequests.createdAt));
  const m = new Map<string, JoinStatus>();
  for (const r of rows) {
    const k = `${r.type}:${r.id}`;
    if (!m.has(k)) m.set(k, r.status as JoinStatus);
  }
  return m;
}

export type SponsorRequest = {
  id: string;
  requesterName: string;
  requesterInitials: string;
  contextType: string;
  contextName: string;
  message: string | null;
};

/** Pending sponsorship asks for the signed-in player (Player Sponsor flow). */
export async function getPendingSponsorships(
  session: Session | null,
): Promise<SponsorRequest[]> {
  if (!session?.playerId) return [];
  const rows = await db
    .select()
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.sponsorPlayerId, session.playerId),
        eq(joinRequests.sponsorStatus, "pending"),
      ),
    )
    .orderBy(desc(joinRequests.createdAt));
  if (!rows.length) return [];

  const pids = [...new Set(rows.map((r) => r.playerId))];
  const pr = await db
    .select({ id: players.id, f: players.firstName, l: players.lastName })
    .from(players)
    .where(inArray(players.id, pids));
  const pMap = new Map(pr.map((p) => [p.id, p]));

  const nameMap = new Map<string, string>();
  const ids = (t: string) =>
    [...new Set(rows.filter((r) => r.contextType === t).map((r) => r.contextId))];
  const [lg, tm, to, cm] = await Promise.all([
    ids("LEAGUE").length ? db.select({ id: leagues.id, name: leagues.name }).from(leagues).where(inArray(leagues.id, ids("LEAGUE"))) : Promise.resolve([]),
    ids("TEAM").length ? db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, ids("TEAM"))) : Promise.resolve([]),
    ids("TOURNAMENT").length ? db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(inArray(tournaments.id, ids("TOURNAMENT"))) : Promise.resolve([]),
    ids("COMMUNITY").length ? db.select({ id: communities.id, name: communities.name }).from(communities).where(inArray(communities.id, ids("COMMUNITY"))) : Promise.resolve([]),
  ]);
  lg.forEach((r) => nameMap.set(`LEAGUE:${r.id}`, r.name));
  tm.forEach((r) => nameMap.set(`TEAM:${r.id}`, r.name));
  to.forEach((r) => nameMap.set(`TOURNAMENT:${r.id}`, r.name));
  cm.forEach((r) => nameMap.set(`COMMUNITY:${r.id}`, r.name));

  return rows.map((r) => {
    const p = pMap.get(r.playerId);
    const name = p ? `${p.f} ${p.l ?? ""}`.trim() : "A player";
    return {
      id: r.id,
      requesterName: name,
      requesterInitials:
        `${p?.f?.[0] ?? ""}${p?.l?.[0] ?? ""}`.toUpperCase() || "•",
      contextType: r.contextType,
      contextName: nameMap.get(`${r.contextType}:${r.contextId}`) ?? "—",
      message: r.message,
    };
  });
}

export type ManagerRequest = {
  id: string;
  contextType: string;
  contextId: string;
  contextName: string;
  status: "pending" | "hold";
  message: string | null;
  createdAt: string;
  sponsorName: string | null;
  sponsorStatus: string | null;
  player: {
    id: string;
    name: string;
    initials: string;
    heightFt: number | null;
    heightIn: number | null;
    position: string | null;
    level: string | null;
    college: string | null;
    avatarUrl: string | null;
  };
};

/** Pending/held join requests for every context the viewer manages. */
export async function getPendingRequestsForManager(
  session: Session | null,
): Promise<ManagerRequest[]> {
  const managed = await managedContextIds(session);

  const reqs = await db
    .select()
    .from(joinRequests)
    .where(inArray(joinRequests.status, ["pending", "hold"]))
    .orderBy(desc(joinRequests.createdAt));

  const mine = reqs.filter((r) => {
    if (managed.admin) return true;
    if (r.contextType === "LEAGUE") return managed.league.includes(r.contextId);
    if (r.contextType === "TEAM") return managed.team.includes(r.contextId);
    if (r.contextType === "TOURNAMENT") return managed.tournament.includes(r.contextId);
    return managed.community.includes(r.contextId);
  });
  if (mine.length === 0) return [];

  // player profiles (requesters + any sponsors)
  const playerIds = [
    ...new Set([
      ...mine.map((r) => r.playerId),
      ...mine.map((r) => r.sponsorPlayerId).filter((x): x is string => !!x),
    ]),
  ];
  const pr = await db
    .select({
      id: players.id,
      first: players.firstName,
      last: players.lastName,
      heightFt: players.heightFt,
      heightIn: players.heightIn,
      position: players.position,
      level: players.level,
      college: players.college,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(inArray(players.id, playerIds));
  const pMap = new Map(pr.map((p) => [p.id, p]));

  // context names per type
  const idsOf = (t: string) =>
    [...new Set(mine.filter((r) => r.contextType === t).map((r) => r.contextId))];
  const nameMap = new Map<string, string>();
  const lgIds = idsOf("LEAGUE");
  const tmIds = idsOf("TEAM");
  const toIds = idsOf("TOURNAMENT");
  const cmIds = idsOf("COMMUNITY");
  const [lgN, tmN, toN, cmN] = await Promise.all([
    lgIds.length ? db.select({ id: leagues.id, name: leagues.name }).from(leagues).where(inArray(leagues.id, lgIds)) : Promise.resolve([]),
    tmIds.length ? db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, tmIds)) : Promise.resolve([]),
    toIds.length ? db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(inArray(tournaments.id, toIds)) : Promise.resolve([]),
    cmIds.length ? db.select({ id: communities.id, name: communities.name }).from(communities).where(inArray(communities.id, cmIds)) : Promise.resolve([]),
  ]);
  lgN.forEach((r) => nameMap.set(`LEAGUE:${r.id}`, r.name));
  tmN.forEach((r) => nameMap.set(`TEAM:${r.id}`, r.name));
  toN.forEach((r) => nameMap.set(`TOURNAMENT:${r.id}`, r.name));
  cmN.forEach((r) => nameMap.set(`COMMUNITY:${r.id}`, r.name));

  return mine.map((r) => {
    const p = pMap.get(r.playerId);
    const name = p ? `${p.first} ${p.last ?? ""}`.trim() : "Player";
    return {
      id: r.id,
      contextType: r.contextType,
      contextId: r.contextId,
      contextName: nameMap.get(`${r.contextType}:${r.contextId}`) ?? "—",
      status: r.status as "pending" | "hold",
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      sponsorName: r.sponsorPlayerId
        ? (() => {
            const s = pMap.get(r.sponsorPlayerId);
            return s ? `${s.first} ${s.last ?? ""}`.trim() : null;
          })()
        : null,
      sponsorStatus: r.sponsorStatus ?? null,
      player: {
        id: r.playerId,
        name,
        initials:
          `${p?.first?.[0] ?? ""}${p?.last?.[0] ?? ""}`.toUpperCase() || "•",
        heightFt: p?.heightFt ?? null,
        heightIn: p?.heightIn ?? null,
        position: p?.position ?? null,
        level: p?.level ?? null,
        college: p?.college ?? null,
        avatarUrl: p?.avatarUrl ?? null,
      },
    };
  });
}
