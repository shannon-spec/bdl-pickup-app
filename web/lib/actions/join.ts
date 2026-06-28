"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  joinRequests,
  players,
  leaguePlayers,
  leagueCommissioners,
  teamPlayers,
  teamCommissioners,
  tournamentMembers,
  communityMembers,
  conversations,
  messages,
  leagues,
  teams,
  tournaments,
  communities,
} from "@/lib/db";
import { readSession, type Session } from "@/lib/auth/session";
import { isAdminLike, canManageLeague, canManageTeam } from "@/lib/auth/perms";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type CtxType = "LEAGUE" | "TOURNAMENT" | "TEAM" | "COMMUNITY";

async function canManageContext(
  session: Session | null,
  type: CtxType,
  id: string,
): Promise<boolean> {
  if (isAdminLike(session)) return true;
  if (!session?.playerId) return false;
  if (type === "LEAGUE") return canManageLeague(session, id);
  if (type === "TEAM") return canManageTeam(session, id);
  const table = type === "TOURNAMENT" ? tournamentMembers : communityMembers;
  const ctxCol =
    type === "TOURNAMENT"
      ? tournamentMembers.tournamentId
      : communityMembers.communityId;
  const playerCol =
    type === "TOURNAMENT"
      ? tournamentMembers.playerId
      : communityMembers.playerId;
  const roleCol =
    type === "TOURNAMENT" ? tournamentMembers.role : communityMembers.role;
  const [r] = await db
    .select({ role: roleCol })
    .from(table)
    .where(and(eq(ctxCol, id), eq(playerCol, session.playerId)))
    .limit(1);
  return r?.role === "DIRECTOR" || r?.role === "COMMISSIONER";
}

async function alreadyMember(
  type: CtxType,
  id: string,
  playerId: string,
): Promise<boolean> {
  if (type === "LEAGUE") {
    const [r] = await db.select({ p: leaguePlayers.playerId }).from(leaguePlayers).where(and(eq(leaguePlayers.leagueId, id), eq(leaguePlayers.playerId, playerId))).limit(1);
    return !!r;
  }
  if (type === "TEAM") {
    const [r] = await db.select({ p: teamPlayers.playerId }).from(teamPlayers).where(and(eq(teamPlayers.teamId, id), eq(teamPlayers.playerId, playerId))).limit(1);
    return !!r;
  }
  if (type === "TOURNAMENT") {
    const [r] = await db.select({ p: tournamentMembers.playerId }).from(tournamentMembers).where(and(eq(tournamentMembers.tournamentId, id), eq(tournamentMembers.playerId, playerId))).limit(1);
    return !!r;
  }
  const [r] = await db.select({ p: communityMembers.playerId }).from(communityMembers).where(and(eq(communityMembers.communityId, id), eq(communityMembers.playerId, playerId))).limit(1);
  return !!r;
}

async function addToRoster(type: CtxType, id: string, playerId: string) {
  if (type === "LEAGUE")
    await db.insert(leaguePlayers).values({ leagueId: id, playerId }).onConflictDoNothing();
  else if (type === "TEAM")
    await db.insert(teamPlayers).values({ teamId: id, playerId }).onConflictDoNothing();
  else if (type === "TOURNAMENT")
    await db.insert(tournamentMembers).values({ tournamentId: id, playerId, role: "PLAYER", status: "active" }).onConflictDoNothing();
  else
    await db.insert(communityMembers).values({ communityId: id, playerId, role: "MEMBER", status: "active" }).onConflictDoNothing();
}

async function getContextName(type: CtxType, id: string): Promise<string> {
  if (type === "LEAGUE") {
    const [r] = await db.select({ n: leagues.name }).from(leagues).where(eq(leagues.id, id)).limit(1);
    return r?.n ?? "the league";
  }
  if (type === "TEAM") {
    const [r] = await db.select({ n: teams.name }).from(teams).where(eq(teams.id, id)).limit(1);
    return r?.n ?? "the team";
  }
  if (type === "TOURNAMENT") {
    const [r] = await db.select({ n: tournaments.name }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
    return r?.n ?? "the tournament";
  }
  const [r] = await db.select({ n: communities.name }).from(communities).where(eq(communities.id, id)).limit(1);
  return r?.n ?? "the community";
}

async function getVisibility(type: CtxType, id: string): Promise<string> {
  if (type === "LEAGUE") {
    const [r] = await db.select({ v: leagues.visibility }).from(leagues).where(eq(leagues.id, id)).limit(1);
    return r?.v ?? "OPEN";
  }
  if (type === "TEAM") {
    const [r] = await db.select({ v: teams.visibility }).from(teams).where(eq(teams.id, id)).limit(1);
    return r?.v ?? "OPEN";
  }
  if (type === "TOURNAMENT") {
    const [r] = await db.select({ v: tournaments.visibility }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
    return r?.v ?? "OPEN";
  }
  const [r] = await db.select({ v: communities.visibility }).from(communities).where(eq(communities.id, id)).limit(1);
  return r?.v ?? "OPEN";
}

/** Deliver a decision as a DM (shows in the bell + /messages). */
async function notifyPlayer(fromId: string | null, toId: string, body: string) {
  if (!fromId || fromId === toId) return;
  const [a, b] = fromId < toId ? [fromId, toId] : [toId, fromId];
  const fromIsA = fromId === a;
  const [convo] = await db
    .insert(conversations)
    .values({ participantA: a, participantB: b, lastMessageAt: sql`now()` })
    .onConflictDoUpdate({
      target: [conversations.participantA, conversations.participantB],
      set: {
        lastMessageAt: sql`now()`,
        ...(fromIsA ? { aClearedAt: sql`null` } : { bClearedAt: sql`null` }),
      },
    })
    .returning({ id: conversations.id });
  await db.insert(messages).values({ conversationId: convo.id, senderId: fromId, body });
}

async function playerName(id: string): Promise<string> {
  const [p] = await db
    .select({ f: players.firstName, l: players.lastName })
    .from(players)
    .where(eq(players.id, id))
    .limit(1);
  return p ? `${p.f} ${p.l ?? ""}`.trim() : "A player";
}

/** Current members of a context (for the sponsor picker). */
export async function getContextPlayers(
  contextType: CtxType,
  contextId: string,
): Promise<{ id: string; name: string }[]> {
  const nm = (f: string, l: string | null) => `${f} ${l ?? ""}`.trim();
  if (contextType === "LEAGUE") {
    const rows = await db
      .select({ id: players.id, f: players.firstName, l: players.lastName })
      .from(leaguePlayers)
      .innerJoin(players, eq(leaguePlayers.playerId, players.id))
      .where(eq(leaguePlayers.leagueId, contextId));
    return rows.map((r) => ({ id: r.id, name: nm(r.f, r.l) }));
  }
  if (contextType === "TEAM") {
    const rows = await db
      .select({ id: players.id, f: players.firstName, l: players.lastName })
      .from(teamPlayers)
      .innerJoin(players, eq(teamPlayers.playerId, players.id))
      .where(eq(teamPlayers.teamId, contextId));
    return rows.map((r) => ({ id: r.id, name: nm(r.f, r.l) }));
  }
  const tbl = contextType === "TOURNAMENT" ? tournamentMembers : communityMembers;
  const ctxCol =
    contextType === "TOURNAMENT"
      ? tournamentMembers.tournamentId
      : communityMembers.communityId;
  const pCol =
    contextType === "TOURNAMENT"
      ? tournamentMembers.playerId
      : communityMembers.playerId;
  const rows = await db
    .select({ id: players.id, f: players.firstName, l: players.lastName })
    .from(tbl)
    .innerJoin(players, eq(pCol, players.id))
    .where(eq(ctxCol, contextId));
  return rows.map((r) => ({ id: r.id, name: nm(r.f, r.l) }));
}

async function getCommissionerIds(
  type: CtxType,
  id: string,
): Promise<string[]> {
  if (type === "LEAGUE") {
    const r = await db.select({ id: leagueCommissioners.playerId }).from(leagueCommissioners).where(eq(leagueCommissioners.leagueId, id));
    return r.map((x) => x.id);
  }
  if (type === "TEAM") {
    const r = await db.select({ id: teamCommissioners.playerId }).from(teamCommissioners).where(eq(teamCommissioners.teamId, id));
    return r.map((x) => x.id);
  }
  if (type === "TOURNAMENT") {
    const r = await db.select({ id: tournamentMembers.playerId }).from(tournamentMembers).where(and(eq(tournamentMembers.tournamentId, id), inArray(tournamentMembers.role, ["DIRECTOR", "COMMISSIONER"])));
    return r.map((x) => x.id);
  }
  const r = await db.select({ id: communityMembers.playerId }).from(communityMembers).where(and(eq(communityMembers.communityId, id), inArray(communityMembers.role, ["DIRECTOR", "COMMISSIONER"])));
  return r.map((x) => x.id);
}

/** Player requests to join a league/team/etc. (Phase 2, Step 4). */
export async function requestToJoin(
  contextType: CtxType,
  contextId: string,
  message: string,
  sponsorPlayerId?: string | null,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId)
    return { ok: false, error: "Sign in to request to join." };
  const pid = session.playerId;

  if (await alreadyMember(contextType, contextId, pid))
    return { ok: false, error: "You're already a member." };

  // Private contexts are invite-only — no public join requests.
  if ((await getVisibility(contextType, contextId)) === "PRIVATE")
    return { ok: false, error: "This isn't accepting join requests." };

  // Re-open a denied/old request, or block duplicate active ones.
  const existing = await db
    .select({ id: joinRequests.id, status: joinRequests.status })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.playerId, pid),
        eq(joinRequests.contextType, contextType),
        eq(joinRequests.contextId, contextId),
      ),
    );
  if (existing.some((r) => r.status === "pending" || r.status === "hold"))
    return { ok: false, error: "Your request is already in review." };

  const sponsor = sponsorPlayerId && sponsorPlayerId !== pid ? sponsorPlayerId : null;
  await db.insert(joinRequests).values({
    playerId: pid,
    contextType,
    contextId,
    message: message?.trim() || null,
    status: "pending",
    sponsorPlayerId: sponsor,
    sponsorStatus: sponsor ? "pending" : null,
  });

  // Ask the chosen sponsor to confirm (DM → bell + /messages + /sponsor).
  if (sponsor) {
    const [reqName, ctxName] = await Promise.all([
      playerName(pid),
      getContextName(contextType, contextId),
    ]);
    await notifyPlayer(
      pid,
      sponsor,
      `${reqName} listed you as their player sponsor for joining ${ctxName}. Accept or decline it on your Sponsorships page.`,
    );
  }

  revalidatePath("/discover");
  return { ok: true, data: null };
}

/** Sponsor accepts/declines a referral. On accept, the commissioners get a DM. */
export async function decideSponsor(
  requestId: string,
  accept: boolean,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Not signed in." };

  const [req] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!req || req.sponsorPlayerId !== session.playerId)
    return { ok: false, error: "Not allowed." };
  if (req.sponsorStatus !== "pending")
    return { ok: false, error: "Already decided." };

  await db
    .update(joinRequests)
    .set({ sponsorStatus: accept ? "accepted" : "declined" })
    .where(eq(joinRequests.id, requestId));

  if (accept) {
    const type = req.contextType as CtxType;
    const [reqName, sponsorN, ctxName, commIds] = await Promise.all([
      playerName(req.playerId),
      playerName(session.playerId),
      getContextName(type, req.contextId),
      getCommissionerIds(type, req.contextId),
    ]);
    for (const cid of commIds) {
      await notifyPlayer(
        session.playerId,
        cid,
        `⭐ ${reqName} was sponsored by ${sponsorN} for their request to join ${ctxName}.`,
      );
    }
  }

  revalidatePath("/sponsor");
  revalidatePath("/manage/requests");
  revalidatePath("/messages");
  return { ok: true, data: null };
}

export async function cancelJoinRequest(
  requestId: string,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Not signed in." };
  await db
    .delete(joinRequests)
    .where(
      and(eq(joinRequests.id, requestId), eq(joinRequests.playerId, session.playerId)),
    );
  revalidatePath("/discover");
  return { ok: true, data: null };
}

/** Commissioner accepts / holds / denies a request (Phase 2, Step 5). */
export async function decideJoinRequest(
  requestId: string,
  decision: "accept" | "hold" | "deny",
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Not signed in." };

  const [req] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!req) return { ok: false, error: "Request not found." };

  const type = req.contextType as CtxType;
  if (!(await canManageContext(session, type, req.contextId)))
    return { ok: false, error: "Not allowed." };

  if (decision === "accept") {
    await addToRoster(type, req.contextId, req.playerId);
  }
  await db
    .update(joinRequests)
    .set({
      status:
        decision === "accept"
          ? "accepted"
          : decision === "hold"
            ? "hold"
            : "denied",
      decidedBy: session.playerId,
      decidedAt: new Date(),
    })
    .where(eq(joinRequests.id, requestId));

  // Notify the player of the decision (DM → bell + /messages).
  const name = await getContextName(type, req.contextId);
  const body =
    decision === "accept"
      ? `🎉 You're in! ${name} accepted your join request.`
      : decision === "hold"
        ? `${name} placed your join request on hold — the organizer may follow up for more info.`
        : `${name} declined your join request for now. You can explore other leagues & teams or re-apply later.`;
  await notifyPlayer(session.playerId, req.playerId, body);

  revalidatePath("/manage/requests");
  revalidatePath("/discover");
  revalidatePath("/messages");
  return { ok: true, data: null };
}

/** Bulk helper used by the queue page to know which ids a manager owns. */
export async function managedContextIds(session: Session | null): Promise<{
  league: string[];
  team: string[];
  tournament: string[];
  community: string[];
  admin: boolean;
}> {
  if (isAdminLike(session))
    return { league: [], team: [], tournament: [], community: [], admin: true };
  if (!session?.playerId)
    return { league: [], team: [], tournament: [], community: [], admin: false };
  const pid = session.playerId;
  const [lc, tc, tm, cm] = await Promise.all([
    db.select({ id: leagueCommissioners.leagueId }).from(leagueCommissioners).where(eq(leagueCommissioners.playerId, pid)),
    db.select({ id: teamCommissioners.teamId }).from(teamCommissioners).where(eq(teamCommissioners.playerId, pid)),
    db.select({ id: tournamentMembers.tournamentId }).from(tournamentMembers).where(and(eq(tournamentMembers.playerId, pid), inArray(tournamentMembers.role, ["DIRECTOR", "COMMISSIONER"]))),
    db.select({ id: communityMembers.communityId }).from(communityMembers).where(and(eq(communityMembers.playerId, pid), inArray(communityMembers.role, ["DIRECTOR", "COMMISSIONER"]))),
  ]);
  return {
    league: lc.map((r) => r.id),
    team: tc.map((r) => r.id),
    tournament: tm.map((r) => r.id),
    community: cm.map((r) => r.id),
    admin: false,
  };
}
