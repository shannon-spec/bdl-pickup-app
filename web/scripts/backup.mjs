#!/usr/bin/env node
/**
 * BDL database backup
 *
 * Dumps every table in the public schema to a single timestamped JSON
 * file under ./backups/. Reads DATABASE_URL_UNPOOLED (preferred) or
 * DATABASE_URL from .env.local — no other config required.
 *
 * Usage: `node --env-file=.env.local scripts/backup.mjs`
 *
 * The output file is restoration-friendly: each entry is
 *   { table: "...", columns: [...], rows: [{...}] }
 * so you can replay it with a small INSERT loop if needed. We also
 * record the schema (column names + types) so the dump is
 * self-describing if a column is added later.
 */
import { neon } from "@neondatabase/serverless";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

// Tables in dependency-friendly order. Restoration in this order with
// FKs disabled (or in batches) avoids constraint trouble.
const TABLES = [
  "super_admins",
  "players",
  "leagues",
  "league_players",
  "league_commissioners",
  "games",
  "game_roster",
  "invites",
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const backupsDir = path.join(repoRoot, "backups");
await fs.mkdir(backupsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
const outFile = path.join(backupsDir, `bdl-${stamp}.json`);

const dump = {
  takenAt: new Date().toISOString(),
  database: conn.replace(/:[^:@/]+@/, ":***@"),
  tables: {},
};

async function dumpTable(t) {
  const cols = await sql.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [t],
  );
  if (cols.length === 0) return null;
  // Table names come from a fixed allowlist or pg_tables — safe to
  // interpolate. Quote to keep snake_case + reserved words happy.
  const rows = await sql.query(`SELECT * FROM "${t}"`);
  return {
    columns: cols.map((c) => ({ name: c.column_name, type: c.data_type })),
    rows,
  };
}

for (const t of TABLES) {
  const d = await dumpTable(t);
  if (!d) {
    console.warn(`! ${t} — no columns; skipping (table missing?)`);
    continue;
  }
  dump.tables[t] = d;
  console.log(`  ${t} — ${d.rows.length} row${d.rows.length === 1 ? "" : "s"}`);
}

// Also discover any tables we forgot to list, so backups don't
// silently drop new tables added in future migrations.
const known = new Set(TABLES);
const all = await sql.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
);
const missed = all.map((r) => r.tablename).filter((n) => !known.has(n));
if (missed.length) {
  console.warn(`! Untracked tables found (add to TABLES): ${missed.join(", ")}`);
  for (const t of missed) {
    const d = await dumpTable(t);
    if (!d) continue;
    dump.tables[t] = d;
    console.log(`  ${t} (auto) — ${d.rows.length} row${d.rows.length === 1 ? "" : "s"}`);
  }
}

await fs.writeFile(outFile, JSON.stringify(dump, null, 2));
const size = (await fs.stat(outFile)).size;
console.log(`\n✓ Wrote ${path.relative(repoRoot, outFile)} (${(size / 1024).toFixed(1)} KB)`);
const totalRows = Object.values(dump.tables).reduce((n, t) => n + t.rows.length, 0);
console.log(`  ${Object.keys(dump.tables).length} tables · ${totalRows} rows`);
