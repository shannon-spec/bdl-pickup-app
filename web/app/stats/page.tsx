import Link from "next/link";
import { eq } from "drizzle-orm";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import {
  getMyMemberLeagueIds,
  getMyCommissionerLeagueIds,
} from "@/lib/auth/perms";
import { db, leagues } from "@/lib/db";
import { getLeaguePlayerStats, type StatLine } from "@/lib/queries/player-stats";

const EXAMPLE_LEAGUE_NAME = "CPA League";

async function getExampleLeagueId(): Promise<string | null> {
  const [row] = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.name, EXAMPLE_LEAGUE_NAME))
    .limit(1);
  return row?.id ?? null;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Player Stats · BDL" };

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const session = await readSession();
  const meId = session?.playerId ?? null;
  const caps = await getViewCaps(session);

  let scopeLeagueIds: string[] | null = null;
  if (caps.view !== "admin") {
    const [memberIds, commishIds] = await Promise.all([
      getMyMemberLeagueIds(session),
      getMyCommissionerLeagueIds(session),
    ]);
    scopeLeagueIds = Array.from(new Set([...memberIds, ...commishIds]));
    if (scopeLeagueIds.length === 0) {
      const exampleId = await getExampleLeagueId();
      if (exampleId) scopeLeagueIds = [exampleId];
    }
  }

  const data = await getLeaguePlayerStats({
    leagueId: sp.league || null,
    year: sp.year || null,
    scopeLeagueIds,
  });

  return (
    <>
      <TopBar active="/stats" />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Player Stats"
          count={
            <span>
              {data.players.length} player{data.players.length === 1 ? "" : "s"} ·{" "}
              {data.totalGames} game{data.totalGames === 1 ? "" : "s"} with stats
            </span>
          }
        />

        <FilterBar
          leagueId={sp.league || null}
          year={sp.year || "all"}
          leagues={data.leagueOptions}
          years={data.yearOptions}
        />

        {data.players.length === 0 ? (
          <div className="rounded-[16px] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
            No box-score stats recorded yet. Enter a game&apos;s box score to see
            player stats here.
          </div>
        ) : (
          <StatsTable rows={data.players} meId={meId} />
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

const COLS: { key: keyof StatLine; label: string; pct?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "ppg", label: "PPG" },
  { key: "rpg", label: "RPG" },
  { key: "apg", label: "APG" },
  { key: "spg", label: "SPG" },
  { key: "bpg", label: "BPG" },
  { key: "fgPct", label: "FG%", pct: true },
  { key: "tpPct", label: "3P%", pct: true },
  { key: "ftPct", label: "FT%", pct: true },
];

function StatsTable({ rows, meId }: { rows: StatLine[]; meId: string | null }) {
  const fmt = (v: number | null, pct?: boolean) => {
    if (v === null) return "—";
    if (pct) return `${Math.round(v)}%`;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  return (
    <div className="overflow-x-auto rounded-[16px] bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] font-bold tracking-[0.08em] uppercase text-[color:var(--text-3)]">
            <th className="sticky left-0 z-10 bg-[color:var(--surface)] text-left px-4 py-2.5 min-w-[170px]">
              Player
            </th>
            {COLS.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-center">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const isMe = p.id === meId;
            return (
              <tr
                key={p.id}
                className={`shadow-[inset_0_-1px_0_0_var(--hairline)] ${
                  isMe ? "bg-[color:var(--brand-soft)]" : ""
                }`}
              >
                <td
                  className={`sticky left-0 z-10 px-4 py-2 min-w-[170px] ${
                    isMe ? "bg-[color:var(--brand-soft)]" : "bg-[color:var(--surface)]"
                  }`}
                >
                  <Link
                    href={`/players/${p.id}`}
                    className="inline-flex items-center gap-2 font-semibold text-[13.5px] hover:text-[color:var(--brand)]"
                  >
                    <span className="text-[color:var(--text-4)] font-[family-name:var(--mono)] text-[11px] num w-5 text-right">
                      {i + 1}
                    </span>
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                {COLS.map((c) => {
                  const v = p[c.key] as number | null;
                  const headline = c.key === "ppg";
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-2 text-center text-[13px] num font-[family-name:var(--mono)] ${
                        headline
                          ? "font-extrabold text-[color:var(--brand-ink)]"
                          : "text-[color:var(--text-2)]"
                      }`}
                    >
                      {fmt(v, c.pct)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilterBar({
  leagueId,
  year,
  leagues,
  years,
}: {
  leagueId: string | null;
  year: string;
  leagues: { id: string; name: string }[];
  years: string[];
}) {
  const linkFor = (lid: string | null, y: string) => {
    const params = new URLSearchParams();
    if (lid) params.set("league", lid);
    if (y && y !== "all") params.set("year", y);
    const qs = params.toString();
    return qs ? `/stats?${qs}` : "/stats";
  };
  const FilterPill = ({
    href,
    active,
    children,
  }: {
    href: string;
    active: boolean;
    children: React.ReactNode;
  }) => (
    <Link
      href={href}
      className={`inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold tracking-[0.04em] uppercase transition-colors border ${
        active
          ? "bg-[color:var(--brand)] text-white border-transparent"
          : "bg-[color:var(--surface)] border-[color:var(--hairline-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </Link>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterPill href={linkFor(null, year)} active={!leagueId}>
        All leagues
      </FilterPill>
      {leagues.map((l) => (
        <FilterPill key={l.id} href={linkFor(l.id, year)} active={leagueId === l.id}>
          {l.name}
        </FilterPill>
      ))}
      <span className="mx-1 text-[color:var(--text-4)]">·</span>
      <FilterPill href={linkFor(leagueId, "all")} active={year === "all"}>
        All time
      </FilterPill>
      {years.map((y) => (
        <FilterPill key={y} href={linkFor(leagueId, y)} active={year === y}>
          {y}
        </FilterPill>
      ))}
    </div>
  );
}
