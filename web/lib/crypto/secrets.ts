/**
 * Application-level encryption for sensitive PII columns
 * (players.email, players.cell, players.birthday).
 *
 * Goals
 *   - Defense in depth: even if the DB is dumped, ciphertext alone is
 *     useless without ENCRYPTION_KEY (kept in Vercel env, separate
 *     trust domain from Neon).
 *   - Source-code safety: no plaintext PII in code, no key in code.
 *   - Compatible writes during a phased migration: ciphertext is
 *     prefixed with "v1:" so legacy plaintext rows pass through
 *     `decryptOptional` unchanged until the migration finishes.
 *
 * Algorithm
 *   - AES-256-GCM with a random 12-byte IV per value (authenticated).
 *   - Format: `v1:<base64-iv>:<base64-tag>:<base64-ciphertext>`
 *
 * Key
 *   - ENCRYPTION_KEY env var, base64-encoded 32 bytes.
 *   - Generate with: `openssl rand -base64 32`
 *   - Set the SAME value in .env.local (for the migration) and Vercel.
 *   - Rotating the key requires a planned re-encryption migration —
 *     don't change it casually.
 *
 * Email lookups
 *   - Encrypted email can't be queried by equality (random IVs), so we
 *     also store a deterministic HMAC-SHA256 hash in `players.email_hash`
 *     with a unique partial index. Login + forgot-password compute the
 *     same hash from the input email and look up by hash.
 */
import crypto from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;
const PREFIX = "v1:";

let _key: Buffer | null = null;
function key(): Buffer {
  if (_key) return _key;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY env var is required. Generate with `openssl rand -base64 32` and set it in .env.local + Vercel.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}). Use a base64-encoded 256-bit key.`,
    );
  }
  _key = buf;
  return _key;
}

/** Returns true when the value looks like our ciphertext format. */
export function isCiphertext(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(PREFIX);
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key(), iv);
  const ct = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Encrypt a nullable string. Empty/null in → null out. */
export function encryptOptional(
  plain: string | null | undefined,
): string | null {
  if (plain === null || plain === undefined) return null;
  const t = typeof plain === "string" ? plain.trim() : "";
  if (t.length === 0) return null;
  // Don't double-encrypt — return as-is if it already looks encrypted.
  if (isCiphertext(t)) return t;
  return encrypt(t);
}

export function decrypt(payload: string): string {
  if (!payload.startsWith(PREFIX)) {
    throw new Error("Not a v1 ciphertext.");
  }
  const body = payload.slice(PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 3) throw new Error("Malformed ciphertext.");
  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const ct = Buffer.from(parts[2], "base64");
  const decipher = crypto.createDecipheriv(ALG, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Decrypt a nullable string. Pass-through for values that don't carry
 * the v1 prefix — lets us roll out encryption without breaking the app
 * for any row whose backfill hasn't run yet.
 */
export function decryptOptional(
  payload: string | null | undefined,
): string | null {
  if (payload === null || payload === undefined) return null;
  if (!isCiphertext(payload)) return payload;
  try {
    return decrypt(payload);
  } catch {
    // Auth tag failure or malformed payload — return null rather than
    // throw, so a single corrupt row doesn't take down a whole page.
    return null;
  }
}

/**
 * Deterministic HMAC-SHA256 of a normalized email. Used for unique
 * lookups (login, forgot password, uniqueness constraint) since the
 * encrypted email value can't be compared by equality.
 *
 * Returns null for empty/missing input so callers can write
 * `email_hash = emailHashOptional(input)` without branching.
 */
export function emailHash(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("Cannot hash an empty email.");
  }
  return crypto
    .createHmac("sha256", key())
    .update(normalized)
    .digest("base64");
}

export function emailHashOptional(
  email: string | null | undefined,
): string | null {
  if (!email) return null;
  const t = email.trim();
  if (t.length === 0) return null;
  return emailHash(t);
}
