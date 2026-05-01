/**
 * One-shot migration — make `player_grades` league-scoped.
 *
 * Before: unique on (target, voter), one global grade.
 * After:  unique on (target, voter, league), one grade per league.
 *
 * Backfill strategy: for each existing row, we "explode" it across
 * every league the voter and target both belong to. Net effect:
 * existing global grades survive in every league where they were
 * meaningfully cast. Rows where the voter+target no longer share a
 * league are dropped (no surface to land on).
 *
 * Run with: `npm run db:migrate:grades`
 *
 * Idempotent: safe to re-run. Uses IF NOT EXISTS / DO blocks so
 * partial-state DBs converge.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("== player_grades → per-league migration ==\n");

  // 1. Add league_id (nullable for now so we can backfill).
  console.log("1/8 add league_id column (nullable)…");
  await sql`ALTER TABLE player_grades ADD COLUMN IF NOT EXISTS league_id uuid`;

  // 2. Drop the LEGACY (target, voter) unique index up front. The
  //    explode INSERT below produces multiple rows per (target,
  //    voter) pair (one per shared league), which the legacy
  //    constraint would block.
  console.log("2/8 drop legacy unique index (target, voter)…");
  await sql`DROP INDEX IF EXISTS player_grades_target_voter_uq`;
  await sql`DROP INDEX IF EXISTS player_grades_target_idx`;

  // 3. Create the new (target, voter, league) unique index BEFORE
  //    the explode INSERT so its ON CONFLICT clause has something
  //    to match. Postgres treats NULL as distinct from NULL, so the
  //    legacy un-leagued rows (still NULL at this point) don't
  //    violate uniqueness.
  console.log("3/8 create new unique index (target, voter, league)…");
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS player_grades_target_voter_league_uq
      ON player_grades (target_player_id, voter_player_id, league_id)
  `;

  // 4. Backfill: explode each existing row across the leagues both
  //    voter and target share. Original (un-leagued) rows are kept
  //    around at this stage so the join can find them; they're
  //    deleted in step 5 once we've replicated their data.
  console.log("4/8 backfill: explode rows across shared leagues…");
  const inserted = (await sql`
    INSERT INTO player_grades
      (id, target_player_id, voter_player_id, league_id, grade, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      pg.target_player_id,
      pg.voter_player_id,
      lp_t.league_id,
      pg.grade,
      pg.created_at,
      pg.updated_at
    FROM player_grades pg
    JOIN league_players lp_t ON lp_t.player_id = pg.target_player_id
    JOIN league_players lp_v
      ON lp_v.player_id = pg.voter_player_id
     AND lp_v.league_id = lp_t.league_id
    WHERE pg.league_id IS NULL
    ON CONFLICT (target_player_id, voter_player_id, league_id)
      DO NOTHING
    RETURNING id
  `) as unknown as { id: string }[];
  console.log(`   inserted ${inserted.length} per-league rows`);

  // 5. Drop orphan rows (voter+target no longer share any league, OR
  //    they were the original un-leagued source rows now superseded).
  console.log("5/8 drop original un-leagued rows…");
  const dropped =
    (await sql`DELETE FROM player_grades WHERE league_id IS NULL RETURNING id`) as unknown as { id: string }[];
  console.log(`   dropped ${dropped.length} rows`);

  // 6. Enforce NOT NULL on league_id now that every surviving row has one.
  console.log("6/8 set league_id NOT NULL…");
  await sql`ALTER TABLE player_grades ALTER COLUMN league_id SET NOT NULL`;

  // 7. Add the FK to leagues (cascade on league delete).
  console.log("7/8 add FK on league_id…");
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'player_grades_league_id_leagues_id_fk'
      ) THEN
        ALTER TABLE player_grades
          ADD CONSTRAINT player_grades_league_id_leagues_id_fk
          FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `;

  // 8. New non-unique lookup index used by per-league reads.
  console.log("8/8 create lookup index…");
  await sql`
    CREATE INDEX IF NOT EXISTS player_grades_target_league_idx
      ON player_grades (target_player_id, league_id)
  `;

  // Sanity check.
  const [{ c }] = (await sql`SELECT count(*)::int AS c FROM player_grades`) as unknown as { c: number }[];
  console.log(`\nDone. player_grades row count: ${c}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
