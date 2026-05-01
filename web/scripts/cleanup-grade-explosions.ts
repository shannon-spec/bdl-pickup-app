/**
 * One-shot cleanup — undo the migration's explode-across-shared-leagues.
 *
 * The per-league migration backfilled by exploding each global vote
 * across every league the voter and target shared. That preserved
 * "data" but violated the principle the new model rests on:
 *   "When you vote, the vote counts only for that league."
 *
 * Going forward (post-deploy), the action requires a leagueId and
 * the upsert key is (target, voter, league), so a voter casting in
 * one league cannot accidentally appear in another. The cleanup
 * here only targets pre-migration explosions.
 *
 * Identification: an exploded group is multiple rows with the same
 * (target_player_id, voter_player_id, grade) where every row in the
 * group shares created_at (the migration preserved the source row's
 * timestamp). We drop the entire group — without the original league
 * intent there's no defensible way to pick a winner.
 *
 * Singleton migrated rows (voter+target had only one shared league)
 * are unambiguous and stay.
 *
 * Run with: `npm run db:cleanup:grade-explosions`
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("== player_grades cleanup: drop migration explosions ==\n");

  // Find groups where (target, voter, grade) has multiple rows AND
  // every row in that group shares the same created_at — the
  // signature of a migration-time explode.
  const groups = (await sql`
    SELECT
      target_player_id,
      voter_player_id,
      grade,
      array_agg(id) AS row_ids,
      array_agg(league_id) AS league_ids,
      count(DISTINCT created_at)::int AS distinct_ts
    FROM player_grades
    GROUP BY target_player_id, voter_player_id, grade
    HAVING count(*) > 1
  `) as {
    target_player_id: string;
    voter_player_id: string;
    grade: string;
    row_ids: string[];
    league_ids: string[];
    distinct_ts: number;
  }[];

  console.log(`Found ${groups.length} candidate group(s):`);
  for (const g of groups) {
    const tag =
      g.distinct_ts === 1 ? "← migration explode (will drop)" : "(distinct timestamps — keeping)";
    console.log(
      `  target=${g.target_player_id.slice(0, 8)}…  voter=${g.voter_player_id.slice(0, 8)}…  grade=${g.grade.padEnd(13)} rows=${g.row_ids.length}  leagues=${g.league_ids.length}  ${tag}`,
    );
  }

  const dropIds = groups
    .filter((g) => g.distinct_ts === 1)
    .flatMap((g) => g.row_ids);

  if (dropIds.length === 0) {
    console.log("\nNothing to drop. Done.");
    return;
  }

  console.log(`\nDropping ${dropIds.length} row(s)…`);
  await sql`DELETE FROM player_grades WHERE id = ANY(${dropIds}::uuid[])`;

  const [{ c }] = (await sql`SELECT count(*)::int AS c FROM player_grades`) as unknown as { c: number }[];
  console.log(`Done. player_grades row count now: ${c}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
