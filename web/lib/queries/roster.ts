import { asc, eq, ilike, or } from "drizzle-orm";
import { db, players, type Player } from "@/lib/db";
import { decryptOptional } from "@/lib/crypto/secrets";
import { decryptPlayerPii } from "@/lib/crypto/player";

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
  // Email search dropped from the where clause — the column is
  // encrypted, so ilike on ciphertext would never match. Name + city
  // search remains; email-based lookup happens via the credentials
  // page or by exact match through email_hash on login.
  const where =
    q && q.length > 0
      ? or(
          ilike(players.lastName, `%${q}%`),
          ilike(players.firstName, `%${q}%`),
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

  return rows
    .map((r) => ({
      ...r,
      email: decryptOptional(r.email),
      cell: decryptOptional(r.cell),
    }))
    .sort((a, b) => {
      const d = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
      if (d !== 0) return d;
      const ln = a.lastName.localeCompare(b.lastName);
      if (ln !== 0) return ln;
      return a.firstName.localeCompare(b.firstName);
    });
}

export async function getPlayer(id: string): Promise<Player | null> {
  const rows = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!rows[0]) return null;
  // Decrypt PII fields at the boundary so the edit form's defaultValue
  // bindings get plain strings, not v1: ciphertext.
  return decryptPlayerPii(rows[0]);
}
