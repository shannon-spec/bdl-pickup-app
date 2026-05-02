"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  conversations,
  messages,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { canMessage, canonicalPair } from "@/lib/auth/messaging";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const sendSchema = z.object({
  toPlayerId: z.string().uuid(),
  body: z.string().trim().min(1, "Message can't be blank.").max(4000),
});

/**
 * Send a 1:1 message. Creates the conversation row on first send so
 * we never fan out empty threads. Authorizes against canMessage so
 * audience rules are enforced consistently with the picker.
 */
export async function sendMessage(input: {
  toPlayerId: string;
  body: string;
}): Promise<ActionResult<{ messageId: string; conversationId: string }>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Sign in to send messages." };

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { toPlayerId, body } = parsed.data;

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

  revalidatePath("/messages");
  revalidatePath(`/messages/${toPlayerId}`);
  return { ok: true, data: { messageId: msg.id, conversationId: convo.id } };
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
