/**
 * BDL DB client.
 *
 * Uses the Neon HTTP driver — fast cold starts on Vercel Functions/
 * Fluid Compute, no connection pool to manage. Suitable for everything
 * the app needs (no long-lived transactions or LISTEN/NOTIFY).
 *
 * `DATABASE_URL` is provisioned automatically when Neon is attached
 * to the Vercel project via the Marketplace integration.
 *
 * Lazy: throws on first query if DATABASE_URL is missing, never at
 * import time, so the build doesn't fail before env is wired.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision Neon in the Vercel dashboard (Storage → Create Database → Neon) and run `vercel env pull .env.local` for local dev.",
    );
  }
  const sql: NeonQueryFunction<false, false> = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

// Proxy so `db.select(...)` triggers connection on first use, not at import.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export * from "./schema";
