import { asc, eq, ilike, or } from "drizzle-orm";
import { db, players, type Player } from "@/lib/db";

export type RosterRow = Pick<
  Player,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "cell"
  | "city"
  | "state"
  | "position"
  | "level"
  | "status"
>;

export async function getRoster(search?: string): Promise<RosterRow[]> {
  const q = search?.trim();
  const where =
    q && q.length > 0
      ? or(
          ilike(players.lastName, `%${q}%`),
          ilike(players.firstName, `%${q}%`),
          ilike(players.email, `%${q}%`),
          ilike(players.city, `%${q}%`),
        )
      : undefined;

  return db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      email: players.email,
      cell: players.cell,
      city: players.city,
      state: players.state,
      position: players.position,
      level: players.level,
      status: players.status,
    })
    .from(players)
    .where(where)
    .orderBy(asc(players.lastName), asc(players.firstName));
}

export async function getPlayer(id: string): Promise<Player | null> {
  const rows = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return rows[0] ?? null;
}
