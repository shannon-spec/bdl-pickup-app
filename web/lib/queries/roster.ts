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

// Higher number = stronger. Sort descending so Pro lands at the top
// and "Not Rated" sinks to the bottom.
const LEVEL_RANK: Record<RosterRow["level"], number> = {
  "Pro": 5,
  "Game Changer": 4,
  "Advanced": 3,
  "Intermediate": 2,
  "Novice": 1,
  "Not Rated": 0,
};

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

  const rows = await db
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

  return rows.sort((a, b) => {
    const d = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
    if (d !== 0) return d;
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName);
  });
}

export async function getPlayer(id: string): Promise<Player | null> {
  const rows = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return rows[0] ?? null;
}
