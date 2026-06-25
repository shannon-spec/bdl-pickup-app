import { asc, desc, eq, isNull, inArray, and, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  teams,
  teamPlayers,
  teamCommissioners,
  players,
  games,
} from "@/lib/db";
import type { Session } from "@/lib/auth/session";

export type TeamGameRow = {
  id: string;
  gameDate: string | null;
  gameTime: string | null;
  gameType: string;
  tournamentName: string | null;
  tournamentRound: string | null;
  venue: string | null;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string;
  teamBName: string;
  teamACity: string | null;
  teamAState: string | null;
  teamBCity: string | null;
  teamBState: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winTeam: "A" | "B" | "Tie" | null;
};

/** All games this team has played / will play (either side), newest first. */
export async function getTeamGames(teamId: string): Promise<TeamGameRow[]> {
  const ta = alias(teams, "ta");
  const tb = alias(teams, "tb");
  return db
    .select({
      id: games.id,
      gameDate: games.gameDate,
      gameTime: games.gameTime,
      gameType: games.gameType,
      tournamentName: games.tournamentName,
      tournamentRound: games.tournamentRound,
      venue: games.venue,
      teamAId: games.teamAId,
      teamBId: games.teamBId,
      teamAName: games.teamAName,
      teamBName: games.teamBName,
      teamACity: ta.city,
      teamAState: ta.state,
      teamBCity: tb.city,
      teamBState: tb.state,
      scoreA: games.scoreA,
      scoreB: games.scoreB,
      winTeam: games.winTeam,
    })
    .from(games)
    .leftJoin(ta, eq(ta.id, games.teamAId))
    .leftJoin(tb, eq(tb.id, games.teamBId))
    .where(or(eq(games.teamAId, teamId), eq(games.teamBId, teamId)))
    .orderBy(desc(games.gameDate), desc(games.gameTime));
}

export type TeamCard = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  defaultFormat: string;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  rosterCount: number;
};

/**
 * Team cards for the /teams list. Admins see every non-hidden team;
 * commissioners see the teams they manage.
 */
export async function getTeamCards(opts: {
  all?: boolean;
  commissionerPlayerId?: string | null;
}): Promise<TeamCard[]> {
  let ids: string[] | null = null;
  if (!opts.all) {
    if (!opts.commissionerPlayerId) return [];
    const mine = await db
      .select({ teamId: teamCommissioners.teamId })
      .from(teamCommissioners)
      .where(eq(teamCommissioners.playerId, opts.commissionerPlayerId));
    ids = mine.map((r) => r.teamId);
    if (ids.length === 0) return [];
  }

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      city: teams.city,
      state: teams.state,
      defaultFormat: teams.defaultFormat,
      avatarKind: teams.avatarKind,
      avatarColor: teams.avatarColor,
      avatarEmoji: teams.avatarEmoji,
      rosterCount: sql<number>`(
        SELECT count(*)::int FROM team_players tp WHERE tp.team_id = ${teams.id}
      )`,
    })
    .from(teams)
    .where(
      ids
        ? and(isNull(teams.hiddenAt), inArray(teams.id, ids))
        : isNull(teams.hiddenAt),
    )
    .orderBy(asc(teams.name));
  return rows;
}

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

/** Teams the viewer is *on the roster of* — drives the context-header
 *  switcher ("part of a team"). Commissioner-only teams (created/managed
 *  but not rostered) are reached via the Teams menu, not the switcher. */
export async function getMyTeamsForSwitcher(s: Session | null): Promise<
  {
    id: string;
    name: string;
    avatarKind: string;
    avatarColor: string;
    avatarEmoji: string | null;
  }[]
> {
  if (!s?.playerId) return [];
  return db
    .select({
      id: teams.id,
      name: teams.name,
      avatarKind: teams.avatarKind,
      avatarColor: teams.avatarColor,
      avatarEmoji: teams.avatarEmoji,
    })
    .from(teams)
    .innerJoin(teamPlayers, eq(teamPlayers.teamId, teams.id))
    .where(and(isNull(teams.hiddenAt), eq(teamPlayers.playerId, s.playerId)))
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
