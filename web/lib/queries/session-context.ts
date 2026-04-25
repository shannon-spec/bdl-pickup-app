import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  players,
  leagues,
  leaguePlayers,
  leagueCommissioners,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { getActiveLeagueId } from "@/lib/cookies/active-league";

export type LeagueRoleInContext = "player" | "commissioner" | "both";

export type SessionLeague = {
  id: string;
  name: string;
  abbr: string;
  season: string;
  cadence: string;
  timeOfDay: string;
  role: LeagueRoleInContext;
};

export type SessionContext = {
  user: { id: string; displayName: string; isSuperAdmin: boolean };
  leagues: SessionLeague[];
  activeLeagueId: string | null;
};

function parseSchedule(s: string | null): { cadence: string; timeOfDay: string } {
  if (!s) return { cadence: "", timeOfDay: "" };
  const parts = s.split("·").map((p) => p.trim());
  return {
    cadence: parts[0] ?? "",
    timeOfDay: parts.slice(1).join(" · ").trim(),
  };
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await readSession();
  if (!session) return null;

  const isSuperAdmin = session.role === "owner" || session.role === "super_admin";

  // displayName — prefer linked roster player; fall back to username.
  let displayName = session.username;
  if (session.playerId) {
    const [p] = await db
      .select({ firstName: players.firstName, lastName: players.lastName })
      .from(players)
      .where(eq(players.id, session.playerId))
      .limit(1);
    if (p) displayName = `${p.firstName} ${p.lastName}`.trim();
  }

  // League memberships + commissioner roles for the linked player
  const memberRows = session.playerId
    ? await db
        .select({ leagueId: leaguePlayers.leagueId })
        .from(leaguePlayers)
        .where(eq(leaguePlayers.playerId, session.playerId))
    : [];
  const commishRows = session.playerId
    ? await db
        .select({ leagueId: leagueCommissioners.leagueId })
        .from(leagueCommissioners)
        .where(eq(leagueCommissioners.playerId, session.playerId))
    : [];

  const memberSet = new Set(memberRows.map((r) => r.leagueId));
  const commishSet = new Set(commishRows.map((r) => r.leagueId));
  const allIds = new Set([...memberSet, ...commishSet]);

  // Super admins with no linked player still need a league context to
  // operate in — show all leagues so they can choose one.
  let leagueRows: {
    id: string;
    name: string;
    season: string | null;
    schedule: string | null;
  }[];
  if (isSuperAdmin && allIds.size === 0) {
    leagueRows = await db
      .select({
        id: leagues.id,
        name: leagues.name,
        season: leagues.season,
        schedule: leagues.schedule,
      })
      .from(leagues)
      .orderBy(asc(leagues.name));
  } else if (allIds.size > 0) {
    leagueRows = await db
      .select({
        id: leagues.id,
        name: leagues.name,
        season: leagues.season,
        schedule: leagues.schedule,
      })
      .from(leagues)
      .where(inArray(leagues.id, Array.from(allIds)))
      .orderBy(asc(leagues.name));
  } else {
    leagueRows = [];
  }

  const sessionLeagues: SessionLeague[] = leagueRows.map((l) => {
    const inMember = memberSet.has(l.id);
    const inCommish = commishSet.has(l.id);
    const role: LeagueRoleInContext =
      inMember && inCommish
        ? "both"
        : inCommish
          ? "commissioner"
          : "player";
    const sched = parseSchedule(l.schedule);
    return {
      id: l.id,
      name: l.name,
      abbr: (l.name[0] ?? "?").toUpperCase(),
      season: l.season ?? "",
      cadence: sched.cadence,
      timeOfDay: sched.timeOfDay,
      role,
    };
  });

  // Active league — cookie wins, else first available
  const stored = await getActiveLeagueId();
  const activeLeagueId =
    (stored && sessionLeagues.find((l) => l.id === stored)?.id) ||
    sessionLeagues[0]?.id ||
    null;

  return {
    user: { id: session.adminId, displayName, isSuperAdmin },
    leagues: sessionLeagues,
    activeLeagueId,
  };
}
