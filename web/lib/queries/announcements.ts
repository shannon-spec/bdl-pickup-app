import { and, desc, eq, gt, isNull, sql as drSql } from "drizzle-orm";
import {
  db,
  announcements,
  announcementRecipients,
  leagues,
  players,
} from "@/lib/db";

export type InboxItem = {
  id: string;
  scope: "global" | "league";
  leagueId: string | null;
  leagueName: string | null;
  authorName: string | null;
  headline: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  createdAt: string;
  readAt: string | null;
};

/**
 * Inbox feed for a player — every announcement they're a recipient of,
 * newest first. Caps at 50 since the inbox isn't paginated yet. Honors
 * the viewer's `players.inbox_cleared_at` watermark by filtering out
 * announcements created on/before the clear timestamp.
 */
export async function getInboxForPlayer(playerId: string): Promise<InboxItem[]> {
  const [viewer] = await db
    .select({ inboxClearedAt: players.inboxClearedAt })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  const clearedAt = viewer?.inboxClearedAt ?? null;

  const rows = await db
    .select({
      id: announcements.id,
      scope: announcements.scope,
      leagueId: announcements.leagueId,
      leagueName: leagues.name,
      authorFirstName: players.firstName,
      authorLastName: players.lastName,
      headline: announcements.headline,
      body: announcements.body,
      ctaLabel: announcements.ctaLabel,
      ctaUrl: announcements.ctaUrl,
      createdAt: announcements.createdAt,
      readAt: announcementRecipients.readAt,
    })
    .from(announcementRecipients)
    .innerJoin(
      announcements,
      eq(announcements.id, announcementRecipients.announcementId),
    )
    .leftJoin(leagues, eq(leagues.id, announcements.leagueId))
    .leftJoin(players, eq(players.id, announcements.authorId))
    .where(
      clearedAt
        ? and(
            eq(announcementRecipients.playerId, playerId),
            gt(announcements.createdAt, clearedAt),
          )
        : eq(announcementRecipients.playerId, playerId),
    )
    .orderBy(desc(announcements.createdAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    scope: r.scope as "global" | "league",
    leagueId: r.leagueId,
    leagueName: r.leagueName,
    authorName:
      r.authorFirstName && r.authorLastName
        ? `${r.authorFirstName} ${r.authorLastName}`.trim()
        : null,
    headline: r.headline,
    body: r.body,
    ctaLabel: r.ctaLabel,
    ctaUrl: r.ctaUrl,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
  }));
}

/** Unread count for the bell badge. Honors the viewer's inbox-clear
 *  watermark so a "Clear inbox" hides the badge along with the rows. */
export async function getUnreadAnnouncementCount(
  playerId: string,
): Promise<number> {
  const [viewer] = await db
    .select({ inboxClearedAt: players.inboxClearedAt })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  const clearedAt = viewer?.inboxClearedAt ?? null;

  const [row] = await db
    .select({ n: drSql<number>`count(*)::int` })
    .from(announcementRecipients)
    .innerJoin(
      announcements,
      eq(announcements.id, announcementRecipients.announcementId),
    )
    .where(
      clearedAt
        ? and(
            eq(announcementRecipients.playerId, playerId),
            isNull(announcementRecipients.readAt),
            gt(announcements.createdAt, clearedAt),
          )
        : and(
            eq(announcementRecipients.playerId, playerId),
            isNull(announcementRecipients.readAt),
          ),
    );
  return row?.n ?? 0;
}

/**
 * Most recent announcements authored by `authorId` — admin/composer
 * history. Includes a recipient count so the composer page can show
 * "sent to N players" without a second query per row.
 */
export type AuthoredAnnouncement = {
  id: string;
  scope: "global" | "league";
  leagueId: string | null;
  leagueName: string | null;
  headline: string;
  body: string;
  channels: string[];
  createdAt: string;
  recipientCount: number;
  readCount: number;
};

export async function getAuthoredAnnouncements(
  authorId: string,
  limit = 20,
): Promise<AuthoredAnnouncement[]> {
  const [viewer] = await db
    .select({ broadcastsClearedAt: players.broadcastsClearedAt })
    .from(players)
    .where(eq(players.id, authorId))
    .limit(1);
  const clearedAt = viewer?.broadcastsClearedAt ?? null;

  const rows = await db
    .select({
      id: announcements.id,
      scope: announcements.scope,
      leagueId: announcements.leagueId,
      leagueName: leagues.name,
      headline: announcements.headline,
      body: announcements.body,
      channels: announcements.channels,
      createdAt: announcements.createdAt,
      recipientCount: drSql<number>`(
        SELECT count(*)::int FROM announcement_recipients ar
        WHERE ar.announcement_id = ${announcements.id}
      )`,
      readCount: drSql<number>`(
        SELECT count(*)::int FROM announcement_recipients ar
        WHERE ar.announcement_id = ${announcements.id} AND ar.read_at IS NOT NULL
      )`,
    })
    .from(announcements)
    .leftJoin(leagues, eq(leagues.id, announcements.leagueId))
    .where(
      clearedAt
        ? and(
            eq(announcements.authorId, authorId),
            gt(announcements.createdAt, clearedAt),
          )
        : eq(announcements.authorId, authorId),
    )
    .orderBy(desc(announcements.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    scope: r.scope as "global" | "league",
    leagueId: r.leagueId,
    leagueName: r.leagueName,
    headline: r.headline,
    body: r.body,
    channels: r.channels ?? ["inbox"],
    createdAt: r.createdAt.toISOString(),
    recipientCount: r.recipientCount,
    readCount: r.readCount,
  }));
}
