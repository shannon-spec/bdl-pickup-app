import { desc, eq } from "drizzle-orm";
import { db, invites, type Invite } from "@/lib/db";

export async function getInvitesForLeague(leagueId: string): Promise<Invite[]> {
  return db
    .select()
    .from(invites)
    .where(eq(invites.leagueId, leagueId))
    .orderBy(desc(invites.createdAt));
}

export async function getInvite(id: string): Promise<Invite | null> {
  const [row] = await db.select().from(invites).where(eq(invites.id, id)).limit(1);
  return row ?? null;
}
