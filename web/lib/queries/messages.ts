/**
 * Queries for 1:1 direct messages.
 *
 * Visibility rules mirror the ones in lib/auth/messaging.ts — anything
 * that surfaces a player as messageable from a viewer's seat must use
 * the same league/role filters used to authorize the actual send.
 */
import { and, asc, desc, eq, gt, inArray, ne, or, sql as drSql } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  players,
  leaguePlayers,
  leagueCommissioners,
} from "@/lib/db";
import { isAdminLike, getMyCommissionerLeagueIds } from "@/lib/auth/perms";
import type { Session } from "@/lib/auth/session";

export type ConversationListItem = {
  conversationId: string;
  otherPlayerId: string;
  otherFirstName: string;
  otherLastName: string;
  otherAvatarUrl: string | null;
  lastBody: string | null;
  lastSenderId: string | null;
  lastMessageAt: string;
  unreadCount: number;
};

/**
 * Conversation list for a player, newest activity first. Honors
 * per-viewer soft-clear (`*ClearedAt`) by skipping any conversation
 * whose last message is older than the viewer's clear timestamp.
 */
export async function getConversationsForPlayer(
  playerId: string,
): Promise<ConversationListItem[]> {
  const rows = await db
    .select({
      id: conversations.id,
      participantA: conversations.participantA,
      participantB: conversations.participantB,
      aClearedAt: conversations.aClearedAt,
      bClearedAt: conversations.bClearedAt,
      lastMessageAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .where(
      or(
        eq(conversations.participantA, playerId),
        eq(conversations.participantB, playerId),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt));

  if (rows.length === 0) return [];

  // Filter out soft-cleared rows whose latest message is older than the
  // viewer's clear timestamp.
  const visible = rows.filter((r) => {
    const isA = r.participantA === playerId;
    const cleared = isA ? r.aClearedAt : r.bClearedAt;
    if (!cleared) return true;
    return r.lastMessageAt.getTime() > cleared.getTime();
  });
  if (visible.length === 0) return [];

  const otherIds = visible.map((r) =>
    r.participantA === playerId ? r.participantB : r.participantA,
  );
  const profiles = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(inArray(players.id, otherIds));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // One latest-message row per conversation.
  const convoIds = visible.map((r) => r.id);
  const lastRows = await db.execute(drSql`
    SELECT DISTINCT ON (conversation_id)
      conversation_id, body, sender_id, created_at
    FROM messages
    WHERE conversation_id IN (${drSql.join(
      convoIds.map((id) => drSql`${id}::uuid`),
      drSql`, `,
    )})
    ORDER BY conversation_id, created_at DESC
  `);
  const lastByConvo = new Map<
    string,
    { body: string; senderId: string; createdAt: Date }
  >();
  for (const r of lastRows.rows as Array<{
    conversation_id: string;
    body: string;
    sender_id: string;
    created_at: string;
  }>) {
    lastByConvo.set(r.conversation_id, {
      body: r.body,
      senderId: r.sender_id,
      createdAt: new Date(r.created_at),
    });
  }

  // Unread = messages NOT sent by viewer AND read_at IS NULL AND newer
  // than the viewer's clear timestamp (if any).
  const unreadRows = await db.execute(drSql`
    SELECT
      c.id AS conversation_id,
      count(*)::int AS n
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE c.id IN (${drSql.join(
      convoIds.map((id) => drSql`${id}::uuid`),
      drSql`, `,
    )})
      AND m.sender_id <> ${playerId}::uuid
      AND m.read_at IS NULL
      AND (
        (c.participant_a = ${playerId}::uuid AND (c.a_cleared_at IS NULL OR m.created_at > c.a_cleared_at))
        OR
        (c.participant_b = ${playerId}::uuid AND (c.b_cleared_at IS NULL OR m.created_at > c.b_cleared_at))
      )
    GROUP BY c.id
  `);
  const unreadByConvo = new Map<string, number>();
  for (const r of unreadRows.rows as Array<{
    conversation_id: string;
    n: number;
  }>) {
    unreadByConvo.set(r.conversation_id, r.n);
  }

  return visible.map((r) => {
    const otherId =
      r.participantA === playerId ? r.participantB : r.participantA;
    const p = profileById.get(otherId);
    const last = lastByConvo.get(r.id);
    return {
      conversationId: r.id,
      otherPlayerId: otherId,
      otherFirstName: p?.firstName ?? "Unknown",
      otherLastName: p?.lastName ?? "",
      otherAvatarUrl: p?.avatarUrl ?? null,
      lastBody: last?.body ?? null,
      lastSenderId: last?.senderId ?? null,
      lastMessageAt: r.lastMessageAt.toISOString(),
      unreadCount: unreadByConvo.get(r.id) ?? 0,
    };
  });
}

/** Total unread across all conversations — top-bar badge. */
export async function getUnreadMessageCount(playerId: string): Promise<number> {
  const [row] = await db.execute(drSql`
    SELECT count(*)::int AS n
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.read_at IS NULL
      AND m.sender_id <> ${playerId}::uuid
      AND (
        (c.participant_a = ${playerId}::uuid AND (c.a_cleared_at IS NULL OR m.created_at > c.a_cleared_at))
        OR
        (c.participant_b = ${playerId}::uuid AND (c.b_cleared_at IS NULL OR m.created_at > c.b_cleared_at))
      )
  `).then((r) => r.rows as Array<{ n: number }>);
  return row?.n ?? 0;
}

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  mine: boolean;
};

/**
 * Full thread between viewer + other, ordered oldest-first. Honors the
 * viewer's clear timestamp — older messages are hidden from the
 * viewer but the other party still sees them.
 *
 * Returns null if the conversation doesn't exist yet (allows the page
 * to render an empty thread for "new conversation").
 */
export async function getThread(
  viewerId: string,
  otherPlayerId: string,
): Promise<{
  conversationId: string | null;
  other: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  messages: ThreadMessage[];
}> {
  const [other] = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(eq(players.id, otherPlayerId))
    .limit(1);

  const a = viewerId < otherPlayerId ? viewerId : otherPlayerId;
  const b = viewerId < otherPlayerId ? otherPlayerId : viewerId;

  const [convo] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.participantA, a),
        eq(conversations.participantB, b),
      ),
    )
    .limit(1);

  if (!convo) {
    return {
      conversationId: null,
      other: other ?? null,
      messages: [],
    };
  }

  const viewerCleared =
    convo.participantA === viewerId ? convo.aClearedAt : convo.bClearedAt;

  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      body: messages.body,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
    })
    .from(messages)
    .where(
      viewerCleared
        ? and(
            eq(messages.conversationId, convo.id),
            gt(messages.createdAt, viewerCleared),
          )
        : eq(messages.conversationId, convo.id),
    )
    .orderBy(asc(messages.createdAt));

  return {
    conversationId: convo.id,
    other: other ?? null,
    messages: rows.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
      mine: m.senderId === viewerId,
    })),
  };
}

export type MessageablePlayer = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Comma-joined league names for picker context — truncate in UI. */
  context: string;
};

/**
 * Set of players the viewer is allowed to start a NEW thread with —
 * used by the "New message" picker. Mirrors canMessage rules.
 */
export async function getMessageablePlayers(
  session: Session,
): Promise<MessageablePlayer[]> {
  if (!session.playerId) return [];
  const isAdmin = isAdminLike(session);

  // Admin → everyone except self.
  if (isAdmin) {
    const rows = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        avatarUrl: players.avatarUrl,
      })
      .from(players)
      .where(ne(players.id, session.playerId))
      .orderBy(asc(players.firstName), asc(players.lastName));
    // Skip league context for admins — too many leagues, too much noise.
    return rows.map((r) => ({ ...r, context: "" }));
  }

  const myCommissioned = await getMyCommissionerLeagueIds(session);
  const myMemberRows = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.playerId, session.playerId));
  const myLeagueIds = myMemberRows.map((r) => r.leagueId);

  // Build a candidate set (player ids) we're allowed to message.
  const candidateIds = new Set<string>();

  // Players who share any of the viewer's leagues (via leaguePlayers).
  if (myLeagueIds.length > 0) {
    const sharers = await db
      .select({ playerId: leaguePlayers.playerId })
      .from(leaguePlayers)
      .where(inArray(leaguePlayers.leagueId, myLeagueIds));
    for (const r of sharers) {
      if (r.playerId !== session.playerId) candidateIds.add(r.playerId);
    }
  }

  // Commissioner add-ons: any commissioner (anywhere) + every player
  // in leagues we commission.
  if (myCommissioned.length > 0) {
    const otherCommissioners = await db
      .select({ playerId: leagueCommissioners.playerId })
      .from(leagueCommissioners);
    for (const r of otherCommissioners) {
      if (r.playerId !== session.playerId) candidateIds.add(r.playerId);
    }
    const myLeagueRosters = await db
      .select({ playerId: leaguePlayers.playerId })
      .from(leaguePlayers)
      .where(inArray(leaguePlayers.leagueId, myCommissioned));
    for (const r of myLeagueRosters) {
      if (r.playerId !== session.playerId) candidateIds.add(r.playerId);
    }
  }

  if (candidateIds.size === 0) return [];

  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(inArray(players.id, Array.from(candidateIds)))
    .orderBy(asc(players.firstName), asc(players.lastName));

  return rows.map((r) => ({ ...r, context: "" }));
}
