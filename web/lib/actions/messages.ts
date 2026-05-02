"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  db,
  conversations,
  messages,
  players,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { canMessage, canonicalPair } from "@/lib/auth/messaging";
import { getViewCaps } from "@/lib/auth/view";
import { decryptOptional } from "@/lib/crypto/secrets";
import {
  isInviteEmailConfigured,
  sendDirectMessageEmail,
} from "@/lib/email/invite-email";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const sendSchema = z.object({
  toPlayerId: z.string().uuid(),
  body: z.string().trim().min(1, "Message can't be blank.").max(4000),
  alsoEmail: z.boolean().optional(),
});

/**
 * Send a 1:1 message. Creates the conversation row on first send so
 * we never fan out empty threads. Authorizes against canMessage so
 * audience rules are enforced consistently with the picker.
 */
export async function sendMessage(input: {
  toPlayerId: string;
  body: string;
  /** When true AND the sender is an admin or commissioner, also
   *  deliver the message via email to the recipient. Silently ignored
   *  for player-view senders or recipients without an email on file. */
  alsoEmail?: boolean;
}): Promise<
  ActionResult<{
    messageId: string;
    conversationId: string;
    emailSent: boolean;
  }>
> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Sign in to send messages." };

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { toPlayerId, body, alsoEmail } = parsed.data;

  if (toPlayerId === session.playerId) {
    return { ok: false, error: "You can't message yourself." };
  }
  if (!(await canMessage(session, toPlayerId))) {
    return { ok: false, error: "You can't message that player." };
  }

  const { a, b } = canonicalPair(session.playerId, toPlayerId);

  // Upsert by canonical pair. ON CONFLICT bumps last_message_at and
  // also clears the SENDER's own clearedAt (so a fresh send brings
  // the conversation back into their list view), but leaves the
  // recipient's clearedAt alone — they'll naturally see the convo
  // again because the new message is newer than their clear ts.
  const isViewerA = session.playerId === a;
  const [convo] = await db
    .insert(conversations)
    .values({ participantA: a, participantB: b, lastMessageAt: sql`now()` })
    .onConflictDoUpdate({
      target: [conversations.participantA, conversations.participantB],
      set: {
        lastMessageAt: sql`now()`,
        ...(isViewerA
          ? { aClearedAt: sql`null` }
          : { bClearedAt: sql`null` }),
      },
    })
    .returning({ id: conversations.id });

  const [msg] = await db
    .insert(messages)
    .values({
      conversationId: convo.id,
      senderId: session.playerId,
      body,
    })
    .returning({ id: messages.id });

  let emailSent = false;
  if (alsoEmail) {
    const caps = await getViewCaps(session);
    const canEmail =
      (caps.view === "admin" || caps.view === "commissioner") &&
      isInviteEmailConfigured();
    if (canEmail) {
      const [recipient] = await db
        .select({
          firstName: players.firstName,
          email: players.email,
        })
        .from(players)
        .where(eq(players.id, toPlayerId))
        .limit(1);
      const [sender] = await db
        .select({
          firstName: players.firstName,
          lastName: players.lastName,
        })
        .from(players)
        .where(eq(players.id, session.playerId))
        .limit(1);
      const decryptedEmail = decryptOptional(recipient?.email ?? null);
      if (recipient && sender && decryptedEmail) {
        const h = await headers();
        const origin =
          h.get("origin") ||
          `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "bdlpickup.com"}`;
        const fromName = `${sender.firstName} ${sender.lastName}`.trim();
        const result = await sendDirectMessageEmail({
          to: decryptedEmail,
          firstName: recipient.firstName,
          fromName,
          body,
          threadUrl: `${origin}/messages/${session.playerId}`,
        });
        emailSent = result.ok;
      }
    }
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${toPlayerId}`);
  return {
    ok: true,
    data: { messageId: msg.id, conversationId: convo.id, emailSent },
  };
}

/** Mark every unread message in this thread (sent by the OTHER party) as read for the viewer. */
export async function markThreadRead(
  otherPlayerId: string,
): Promise<ActionResult<{ count: number }>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Sign in." };

  const { a, b } = canonicalPair(session.playerId, otherPlayerId);
  const [convo] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.participantA, a),
        eq(conversations.participantB, b),
      ),
    )
    .limit(1);
  if (!convo) return { ok: true, data: { count: 0 } };

  // Update everything sent by other party that's still unread.
  const updated = await db
    .update(messages)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(messages.conversationId, convo.id),
        eq(messages.senderId, otherPlayerId),
        sql`${messages.readAt} IS NULL`,
      ),
    )
    .returning({ id: messages.id });

  revalidatePath("/messages");
  revalidatePath(`/messages/${otherPlayerId}`);
  return { ok: true, data: { count: updated.length } };
}

/**
 * Soft-clear: hides this conversation from the VIEWER's list. The
 * other party still sees the full history. Future messages newer than
 * the clear timestamp re-surface the convo for the viewer.
 */
export async function clearConversation(
  otherPlayerId: string,
): Promise<ActionResult<{ ok: true }>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Sign in." };

  const { a, b } = canonicalPair(session.playerId, otherPlayerId);
  const isViewerA = session.playerId === a;

  await db
    .update(conversations)
    .set(
      isViewerA
        ? { aClearedAt: sql`now()` }
        : { bClearedAt: sql`now()` },
    )
    .where(
      and(
        eq(conversations.participantA, a),
        eq(conversations.participantB, b),
      ),
    );

  revalidatePath("/messages");
  return { ok: true, data: { ok: true } };
}

/** Bulk soft-clear every conversation for the viewer. Used by "Clear recent messages". */
export async function clearAllConversations(): Promise<
  ActionResult<{ count: number }>
> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Sign in." };

  const updatedA = await db
    .update(conversations)
    .set({ aClearedAt: sql`now()` })
    .where(eq(conversations.participantA, session.playerId))
    .returning({ id: conversations.id });
  const updatedB = await db
    .update(conversations)
    .set({ bClearedAt: sql`now()` })
    .where(eq(conversations.participantB, session.playerId))
    .returning({ id: conversations.id });

  revalidatePath("/messages");
  return {
    ok: true,
    data: { count: updatedA.length + updatedB.length },
  };
}
