import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  leagues,
  leaguePlayers,
  leagueCommissioners,
  players,
  scheduleSlots,
  tournaments,
  tournamentMembers,
  communities,
  communityMembers,
  organizeInvitations,
  divisions,
  registrations,
  matches,
  teams,
} from "@/lib/db";
import { isAdminLike, canManageLeague } from "@/lib/auth/perms";
import type { Session } from "@/lib/auth/session";

export type RegRow = {
  id: string;
  label: string;
  seed: number | null;
  status: "pending" | "confirmed" | "waitlist";
  paid: boolean;
};

export type MatchRow = {
  id: string;
  round: number;
  slot: number;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerRegistrationId: string | null;
  nextMatchId: string | null;
  nextSlotIsHome: boolean | null;
  bracketGroup: string | null;
  locked: boolean;
};

export type ManageDivision = {
  id: string;
  name: string;
  ageBand: string;
  skillTier: string | null;
  cap: number | null;
  registrationOpen: boolean;
  registrations: RegRow[];
  matches: MatchRow[];
};

export type ManageTournament = {
  id: string;
  name: string;
  slug: string | null;
  teamSize: string | null;
  bracketFormat: string | null;
  registrationMode: string;
  entryFeeCents: number | null;
  published: boolean;
  startDate: string | null;
  endsAt: string | null;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  canManage: boolean;
  divisions: ManageDivision[];
};

export type ManageLeague = {
  id: string;
  name: string;
  days: number[] | null;
  startTime: string | null;
  startDate: string | null;
  playStyle: string | null;
  seasonLength: number | null;
  venueName: string | null;
  venueAddress: string | null;
  published: boolean;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  canManage: boolean;
  members: { id: string; name: string }[];
  commissioners: { id: string; name: string }[];
  slots: { id: string; startsAt: string; court: string | null }[];
};

export async function getManageLeague(
  session: Session | null,
  id: string,
): Promise<ManageLeague | null> {
  const [lg] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!lg || lg.hiddenAt) return null;

  const canManage = await canManageLeague(session, id);

  const memberRows = await db
    .select({ id: players.id, first: players.firstName, last: players.lastName })
    .from(leaguePlayers)
    .innerJoin(players, eq(leaguePlayers.playerId, players.id))
    .where(eq(leaguePlayers.leagueId, id));
  const commRows = await db
    .select({ id: players.id, first: players.firstName, last: players.lastName })
    .from(leagueCommissioners)
    .innerJoin(players, eq(leagueCommissioners.playerId, players.id))
    .where(eq(leagueCommissioners.leagueId, id));

  const slotRows = await db
    .select()
    .from(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.contextType, "LEAGUE"),
        eq(scheduleSlots.contextId, id),
      ),
    )
    .orderBy(asc(scheduleSlots.startsAt));

  const nm = (f: string, l: string | null) => `${f} ${l ?? ""}`.trim();

  return {
    id: lg.id,
    name: lg.name,
    days: (lg.days as number[] | null) ?? null,
    startTime: lg.startTime,
    startDate: lg.startDate,
    playStyle: lg.playStyle,
    seasonLength: lg.seasonLength,
    venueName: lg.venueName,
    venueAddress: lg.venueAddress,
    published: lg.published,
    avatarKind: lg.avatarKind,
    avatarColor: lg.avatarColor,
    avatarEmoji: lg.avatarEmoji,
    canManage,
    members: memberRows.map((r) => ({ id: r.id, name: nm(r.first, r.last) })),
    commissioners: commRows.map((r) => ({ id: r.id, name: nm(r.first, r.last) })),
    slots: slotRows.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      court: s.court,
    })),
  };
}

export type ManageCommunity = {
  id: string;
  name: string;
  kind: string | null;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  canManage: boolean;
  events: { type: "LEAGUE" | "TOURNAMENT"; id: string; name: string; published: boolean }[];
  members: { id: string; name: string; role: string }[];
  pendingInviteTokens: string[];
};

export async function getManageCommunity(
  session: Session | null,
  id: string,
): Promise<ManageCommunity | null> {
  const [c] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, id))
    .limit(1);
  if (!c || c.hiddenAt) return null;

  let canManage = isAdminLike(session);
  if (!canManage && session?.playerId) {
    const [r] = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, id),
          eq(communityMembers.playerId, session.playerId),
        ),
      )
      .limit(1);
    canManage =
      r?.role === "DIRECTOR" || r?.role === "COMMISSIONER" || r?.role === "MEMBER";
  }

  const lgEvents = await db
    .select({ id: leagues.id, name: leagues.name, published: leagues.published })
    .from(leagues)
    .where(and(eq(leagues.communityId, id), isNull(leagues.hiddenAt)));
  const tEvents = await db
    .select({ id: tournaments.id, name: tournaments.name, published: tournaments.published })
    .from(tournaments)
    .where(and(eq(tournaments.communityId, id), isNull(tournaments.hiddenAt)));

  const memberRows = await db
    .select({
      id: players.id,
      first: players.firstName,
      last: players.lastName,
      role: communityMembers.role,
    })
    .from(communityMembers)
    .innerJoin(players, eq(communityMembers.playerId, players.id))
    .where(eq(communityMembers.communityId, id));

  const invites = canManage
    ? await db
        .select({ token: organizeInvitations.token })
        .from(organizeInvitations)
        .where(
          and(
            eq(organizeInvitations.contextType, "COMMUNITY"),
            eq(organizeInvitations.contextId, id),
            eq(organizeInvitations.status, "pending"),
          ),
        )
    : [];

  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    avatarKind: c.avatarKind,
    avatarColor: c.avatarColor,
    avatarEmoji: c.avatarEmoji,
    canManage,
    events: [
      ...lgEvents.map((e) => ({ type: "LEAGUE" as const, ...e })),
      ...tEvents.map((e) => ({ type: "TOURNAMENT" as const, ...e })),
    ],
    members: memberRows.map((r) => ({
      id: r.id,
      name: `${r.first} ${r.last ?? ""}`.trim(),
      role: r.role,
    })),
    pendingInviteTokens: invites.map((i) => i.token),
  };
}

/** Public read of a published tournament by slug (canManage=false). */
export async function getPublicTournament(
  slug: string,
): Promise<ManageTournament | null> {
  const [t] = await db
    .select({ id: tournaments.id, published: tournaments.published })
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);
  if (!t || !t.published) return null;
  return getManageTournament(null, t.id);
}

async function canManageTournament(
  session: Session | null,
  tournamentId: string,
): Promise<boolean> {
  if (isAdminLike(session)) return true;
  if (!session?.playerId) return false;
  const [row] = await db
    .select({ role: tournamentMembers.role })
    .from(tournamentMembers)
    .where(
      and(
        eq(tournamentMembers.tournamentId, tournamentId),
        eq(tournamentMembers.playerId, session.playerId),
      ),
    )
    .limit(1);
  return row?.role === "DIRECTOR" || row?.role === "COMMISSIONER";
}

export async function getManageTournament(
  session: Session | null,
  id: string,
): Promise<ManageTournament | null> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t || t.hiddenAt) return null;

  const canManage = await canManageTournament(session, id);

  const divRows = await db
    .select()
    .from(divisions)
    .where(and(eq(divisions.contextType, "TOURNAMENT"), eq(divisions.contextId, id)))
    .orderBy(asc(divisions.sortOrder));

  const divIds = divRows.map((d) => d.id);

  const regRows = divIds.length
    ? await db
        .select({
          id: registrations.id,
          divisionId: registrations.divisionId,
          teamName: registrations.teamName,
          teamId: registrations.teamId,
          seed: registrations.seed,
          status: registrations.status,
          paid: registrations.paid,
          joinedName: teams.name,
        })
        .from(registrations)
        .leftJoin(teams, eq(registrations.teamId, teams.id))
        .where(inArray(registrations.divisionId, divIds))
    : [];

  const matchRows = divIds.length
    ? await db
        .select()
        .from(matches)
        .where(inArray(matches.divisionId, divIds))
        .orderBy(asc(matches.round), asc(matches.slot))
    : [];

  const divisionsOut: ManageDivision[] = divRows.map((d) => ({
    id: d.id,
    name: d.name,
    ageBand: d.ageBand,
    skillTier: d.skillTier,
    cap: d.cap,
    registrationOpen: d.registrationOpen,
    registrations: regRows
      .filter((r) => r.divisionId === d.id)
      .map((r) => ({
        id: r.id,
        label: r.teamName?.trim() || r.joinedName || "Entry",
        seed: r.seed,
        status: r.status,
        paid: r.paid,
      }))
      .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999)),
    matches: matchRows
      .filter((m) => m.divisionId === d.id)
      .map((m) => ({
        id: m.id,
        round: m.round,
        slot: m.slot,
        homeRegistrationId: m.homeRegistrationId,
        awayRegistrationId: m.awayRegistrationId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        winnerRegistrationId: m.winnerRegistrationId,
        nextMatchId: m.nextMatchId,
        nextSlotIsHome: m.nextSlotIsHome,
        bracketGroup: m.bracketGroup,
        locked: m.locked,
      })),
  }));

  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    teamSize: t.teamSize,
    bracketFormat: t.bracketFormat,
    registrationMode: t.registrationMode,
    entryFeeCents: t.entryFeeCents,
    published: t.published,
    startDate: t.startDate,
    endsAt: t.endsAt,
    avatarKind: t.avatarKind,
    avatarColor: t.avatarColor,
    avatarEmoji: t.avatarEmoji,
    canManage,
    divisions: divisionsOut,
  };
}
