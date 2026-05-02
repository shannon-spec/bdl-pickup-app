/**
 * Player decryption boundary — applies decryptOptional to cell, email,
 * and birthday so callers can keep using the existing field names
 * without thinking about ciphertext.
 *
 * Use at the END of any query that selects these columns, immediately
 * before returning. Reads inside server components / server actions
 * should always go through this helper.
 */
import { decryptOptional } from "./secrets";

type PiiFields = {
  email?: string | null;
  cell?: string | null;
  birthday?: string | null;
};

/** Decrypts cell/email/birthday in place on a single row. */
export function decryptPlayerPii<T extends PiiFields>(player: T): T {
  return {
    ...player,
    email: decryptOptional(player.email),
    cell: decryptOptional(player.cell),
    birthday: decryptOptional(player.birthday),
  };
}

/** Same, for arrays. */
export function decryptPlayerListPii<T extends PiiFields>(players: T[]): T[] {
  return players.map(decryptPlayerPii);
}
