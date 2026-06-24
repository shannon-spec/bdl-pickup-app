import { asc, eq } from "drizzle-orm";
import {
  db,
  teams,
  teamPlayers,
  teamCommissioners,
  players,
} from "@/lib/db";
import type { Session } from "@/lib/auth/session";

export type TeamRosterMember = {
  id: string;
  firstName: string;
  lastName: string;
  status: "Active" | "Inactive" | "IR";
  position: string | null;
};

export type TeamDetail = {
  team: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    description: string | null;
    defaultFormat: string;
    avatarKind: string;
    avatarColor: string;
    avatarEmoji: string | null;
  };
  roster: TeamRosterMember[];
  commissionerIds: string[];
};

export async function getTeamDetail(id: string): Promise<TeamDetail | null> {
  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      city: teams.city,
      state: teams.state,
      description: teams.description,
      defaultFormat: teams.defaultFormat,
      avatarKind: teams.avatarKind,
      avatarColor: teams.avatarColor,
      avatarEmoji: teams.avatarEmoji,
    })
    .from(teams)
    .where(eq(teams.id, id))
    .limit(1);
  if (!team) return null;

  const roster = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      status: players.status,
      position: players.position,
    })
    .from(players)
    .innerJoin(teamPlayers, eq(teamPlayers.playerId, players.id))
    .where(eq(teamPlayers.teamId, id))
    .orderBy(asc(players.lastName), asc(players.firstName));

  const commishRows = await db
    .select({ playerId: teamCommissioners.playerId })
    .from(teamCommissioners)
    .where(eq(teamCommissioners.teamId, id));

  return {
    team,
    roster,
    commissionerIds: commishRows.map((r) => r.playerId),
  };
}

/** Teams the viewer commissions (for listing / opponent pickers). */
export async function getMyTeams(
  s: Session | null,
): Promise<{ id: string; name: string }[]> {
  if (!s?.playerId) return [];
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .innerJoin(teamCommissioners, eq(teamCommissioners.teamId, teams.id))
    .where(eq(teamCommissioners.playerId, s.playerId))
    .orderBy(asc(teams.name));
}

/** Players not yet on the team's roster — drives the add-member picker. */
export async function getEligibleTeamMembers(
  teamId: string,
): Promise<{ id: string; firstName: string; lastName: string }[]> {
  const memberRows = await db
    .select({ playerId: teamPlayers.playerId })
    .from(teamPlayers)
    .where(eq(teamPlayers.teamId, teamId));
  const set = new Set(memberRows.map((r) => r.playerId));
  const all = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players)
    .orderBy(asc(players.lastName), asc(players.firstName));
  return all.filter((p) => !set.has(p.id));
}
