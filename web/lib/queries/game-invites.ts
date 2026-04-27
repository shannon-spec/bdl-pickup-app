/**
 * Read-side queries for the Invite Manager. Write-side lives in
 * lib/actions/game-invites.ts.
 */
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  db,
  gameInvites,
  gameInviteEvents,
  gameRoster,
  games,
  leagues,
  leaguePlayers,
  players,
  type GameInvite,
} from "@/lib/db";

/**
 * Lazy expiry: flip any past-due pending invites to expired before
 * returning them. Cron-driven sweep still runs once daily on the
 * Hobby plan, but we don't want stale pending rows in the UI between
 * sweeps. Idempotent.
 */
async function expirePastDueForGame(gameId: string) {
  await db
    .update(gameInvites)
    .set({ state: "expired" })
    .where(
      and(
        eq(gameInvites.gameId, gameId),
        eq(gameInvites.state, "pending"),
        lt(gameInvites.expiresAt, new Date()),
      ),
    );
}

export type InviteRow = GameInvite & {
  player: { id: string; firstName: string; lastName: string; email: string | null };
};

const ACTIVE_STATES = ["queued", "pending"] as const;
const FINAL_STATES = [
  "confirmed",
  "declined",
  "expired",
  "cancelled",
  "superseded",
] as const;

export type InviteSettings = {
  expiryMinutes: number;
  fcfsEnabled: boolean;
  overInviteCap: number;
  autoBackfill: boolean;
  reminderLeadMinutes: number;
  allowedChannels: string[];
  targetSeats: number;
};

/**
 * Per-game effective Invite Manager settings — merges league
 * defaults with any game-level overrides. Used by the action layer
 * (to set expires_at, decide capacity) and the UI (to render the
 * Edit Invite Rules modal).
 */
export async function getEffectiveInviteSettings(
  gameId: string,
): Promise<InviteSettings | null> {
  const [g] = await db
    .select({
      leagueId: games.leagueId,
      format: games.format,
      numInvites: games.numInvites,
      targetSeats: games.targetSeats,
      gameExpiry: games.inviteExpiryMinutes,
      gameFcfs: games.inviteFcfsEnabled,
      gameOverCap: games.inviteOverInviteCap,
      gameAutoBackfill: games.inviteAutoBackfill,
      gameReminder: games.inviteReminderLeadMinutes,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!g) return null;

  let leagueRow: {
    expiry: number;
    fcfs: boolean;
    overCap: number;
    autoBackfill: boolean;
    reminder: number;
    channels: string[];
  } = {
    expiry: 120,
    fcfs: false,
    overCap: 2,
    autoBackfill: false,
    reminder: 15,
    channels: ["email"],
  };
  if (g.leagueId) {
    const [l] = await db
      .select({
        expiry: leagues.inviteExpiryMinutes,
        fcfs: leagues.inviteFcfsEnabled,
        overCap: leagues.inviteOverInviteCap,
        autoBackfill: leagues.inviteAutoBackfill,
        reminder: leagues.inviteReminderLeadMinutes,
        channels: leagues.inviteAllowedChannels,
      })
      .from(leagues)
      .where(eq(leagues.id, g.leagueId))
      .limit(1);
    if (l) leagueRow = l;
  }

  // Default seat count — per game override > game.numInvites > 5v5/3v3.
  const formatDefault = g.format === "3v3" ? 6 : 10;
  const targetSeats =
    g.targetSeats ??
    (g.numInvites && g.numInvites > 0 ? g.numInvites : formatDefault);

  return {
    targetSeats,
    expiryMinutes: g.gameExpiry ?? leagueRow.expiry,
    fcfsEnabled: g.gameFcfs ?? leagueRow.fcfs,
    overInviteCap: g.gameOverCap ?? leagueRow.overCap,
    autoBackfill: g.gameAutoBackfill ?? leagueRow.autoBackfill,
    reminderLeadMinutes: g.gameReminder ?? leagueRow.reminder,
    allowedChannels: leagueRow.channels,
  };
}

/** All invites for a game, with player join. */
export async function getInvitesForGame(gameId: string): Promise<InviteRow[]> {
  await expirePastDueForGame(gameId);
  const rows = await db
    .select({
      invite: gameInvites,
      player: {
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        email: players.email,
      },
    })
    .from(gameInvites)
    .innerJoin(players, eq(players.id, gameInvites.playerId))
    .where(eq(gameInvites.gameId, gameId))
    .orderBy(desc(gameInvites.createdAt));
  return rows.map((r) => ({ ...r.invite, player: r.player }));
}

/**
 * Eligible invite pool for a game: league members not currently in
 * an active (queued/pending) invite, not already on the roster, not
 * the same as the game-winner. Returns just enough for the UI list.
 */
export async function getInvitePool(
  gameId: string,
): Promise<
  {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    level: string;
    status: string;
    email: string | null;
    cell: string | null;
  }[]
> {
  await expirePastDueForGame(gameId);
  const [g] = await db
    .select({ leagueId: games.leagueId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!g?.leagueId) return [];

  const memberRows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      avatarUrl: players.avatarUrl,
      level: players.level,
      status: players.status,
      email: players.email,
      cell: players.cell,
    })
    .from(players)
    .innerJoin(leaguePlayers, eq(leaguePlayers.playerId, players.id))
    .where(eq(leaguePlayers.leagueId, g.leagueId))
    .orderBy(asc(players.lastName), asc(players.firstName));

  // Players already on the roster for this game (any side).
  const onRoster = await db
    .select({ playerId: gameRoster.playerId })
    .from(gameRoster)
    .where(eq(gameRoster.gameId, gameId));
  const rosterIds = new Set(onRoster.map((r) => r.playerId));

  // Players in active invite state (queued / pending) for this game.
  const active = await db
    .select({ playerId: gameInvites.playerId })
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.gameId, gameId),
        inArray(gameInvites.state, [...ACTIVE_STATES]),
      ),
    );
  const activeIds = new Set(active.map((r) => r.playerId));

  return memberRows.filter(
    (p) => !rosterIds.has(p.id) && !activeIds.has(p.id),
  );
}

/** Used by the public claim page. */
export async function getInviteByToken(token: string) {
  const [row] = await db
    .select({
      invite: gameInvites,
      game: games,
      league: { id: leagues.id, name: leagues.name },
      player: {
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
      },
    })
    .from(gameInvites)
    .innerJoin(games, eq(games.id, gameInvites.gameId))
    .leftJoin(leagues, eq(leagues.id, games.leagueId))
    .innerJoin(players, eq(players.id, gameInvites.playerId))
    .where(eq(gameInvites.claimToken, token))
    .limit(1);
  return row ?? null;
}

export type ActivityRow = {
  id: string;
  inviteId: string;
  type: string;
  note: string | null;
  createdAt: Date;
  player: { id: string; firstName: string; lastName: string };
  actor: { id: string; firstName: string; lastName: string } | null;
};

/** Activity feed for a game (newest first). */
export async function getInviteActivity(
  gameId: string,
  limit = 50,
): Promise<ActivityRow[]> {
  const actor = sql<unknown>`NULL`; // placeholder typed via select
  void actor;

  const rows = await db.execute(sql`
    SELECT e.id, e.invite_id, e.type, e.note, e.created_at,
           p.id as player_id, p.first_name as player_first, p.last_name as player_last,
           a.id as actor_id, a.first_name as actor_first, a.last_name as actor_last
    FROM game_invite_events e
    JOIN game_invites i ON i.id = e.invite_id
    JOIN players p ON p.id = i.player_id
    LEFT JOIN players a ON a.id = e.actor_id
    WHERE e.game_id = ${gameId}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `);
  // Drizzle execute returns either an array or { rows } depending on driver.
  // Neon HTTP returns rows on .rows.
  type RawRow = {
    id: string;
    invite_id: string;
    type: string;
    note: string | null;
    created_at: Date | string;
    player_id: string;
    player_first: string;
    player_last: string;
    actor_id: string | null;
    actor_first: string | null;
    actor_last: string | null;
  };
  const list: RawRow[] = (rows as unknown as { rows?: RawRow[] }).rows ?? (rows as unknown as RawRow[]);
  return list.map((r) => ({
    id: r.id,
    inviteId: r.invite_id,
    type: r.type,
    note: r.note,
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    player: {
      id: r.player_id,
      firstName: r.player_first,
      lastName: r.player_last,
    },
    actor:
      r.actor_id && r.actor_first && r.actor_last
        ? { id: r.actor_id, firstName: r.actor_first, lastName: r.actor_last }
        : null,
  }));
}

/** Confirmed seat counts split by team, used for capacity checks. */
export async function getConfirmedCounts(gameId: string) {
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(gameInvites)
    .where(
      and(eq(gameInvites.gameId, gameId), eq(gameInvites.state, "confirmed")),
    );
  // Add roster confirmations too (manual roster adds count toward capacity).
  const roster = await db
    .select({ playerId: gameRoster.playerId, side: gameRoster.side })
    .from(gameRoster)
    .where(eq(gameRoster.gameId, gameId));
  const rosterAB = roster.filter((r) => r.side === "A" || r.side === "B").length;
  return {
    confirmed: Number(row?.total ?? 0),
    onRoster: rosterAB,
    total: Number(row?.total ?? 0) + rosterAB,
  };
}

void isNull; // keep import noise away from the linter
