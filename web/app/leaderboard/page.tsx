import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { getLeaderboard, type LbPlayer } from "@/lib/queries/leaderboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard · BDL" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; year?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/discover");

  const sp = await searchParams;
  const data = await getLeaderboard({
    leagueId: sp.league || null,
    year: sp.year || null,
  });

  return (
    <>
      <TopBar
        active="/leaderboard"
      />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Leaderboard"
          count={
            <span>
              {data.totalCompleted} games · min {data.minGames} to qualify
            </span>
          }
        />

        <FilterBar
          leagueId={sp.league || null}
          year={sp.year || "all"}
          leagues={data.leagueOptions}
          years={data.yearOptions}
        />

        <div className="grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
          <Board
            title="Highest Win %"
            rows={data.topWinPct}
            valueKey="pct"
            valueLabel="Win %"
            isPercent
            featured="win"
          />
          <Board title="Most Wins" rows={data.topWins} valueKey="wins" valueLabel="W" />
        </div>

        <div className="grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
          <Board
            title="Most Games Played"
            rows={data.topGamesPlayed}
            valueKey="gamesPlayed"
            valueLabel="GP"
            playedOf={data.totalCompleted}
            featured="brand"
          />
          <Board
            title="Game Winner Awards"
            rows={data.topGW}
            valueKey="gameWinnerCount"
            valueLabel="GW"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
          <Board
            title="Heroes · Margin ≤ 3"
            rows={data.topHeroes}
            valueKey="heroCount"
            valueLabel="HERO"
            hero
          />
          <Board title="Most Losses" rows={data.topLosses} valueKey="losses" valueLabel="L" />
        </div>

        <div className="grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
          <Board
            title="Lowest Win %"
            rows={data.lowWinPct}
            valueKey="pct"
            valueLabel="Win %"
            isPercent
            negative
          />
        </div>
      </PageFrame>
      <MobileBottomBar active="leaderboard" />
    </>
  );
}

function Board({
  title,
  rows,
  valueKey,
  valueLabel,
  isPercent,
  negative,
  full,
  hero,
  featured,
  playedOf,
}: {
  title: string;
  rows: LbPlayer[];
  valueKey: keyof LbPlayer;
  valueLabel: string;
  isPercent?: boolean;
  negative?: boolean;
  full?: boolean;
  hero?: boolean;
  /** Tinted "primary" treatment. "win" = green; "brand" = blue. */
  featured?: "win" | "brand";
  /**
   * When set, the GP slot shows "% played" derived from gamesPlayed /
   * playedOf — used by the Most Games Played board to surface
   * attendance share without adding a sixth column.
   */
  playedOf?: number;
}) {
  // Featured wins out over hero if both are passed.
  const tinted = !!featured || !!hero;
  // Featured palettes — keep tints light so the lists stay legible.
  const featuredTints = {
    win: {
      border: "rgba(38,166,91,.45)",
      gradient:
        "linear-gradient(135deg, rgba(38,166,91,.12), transparent 65%), var(--surface)",
      shadow: "0 1px 0 0 rgba(38,166,91,.10) inset",
      hairline: "rgba(38,166,91,.25)",
      title: "var(--up)",
    },
    brand: {
      border: "rgba(13,139,255,.45)",
      gradient:
        "linear-gradient(135deg, rgba(13,139,255,.12), transparent 65%), var(--surface)",
      shadow: "0 1px 0 0 rgba(13,139,255,.10) inset",
      hairline: "rgba(13,139,255,.25)",
      title: "var(--brand-ink)",
    },
  } as const;
  const ft = featured ? featuredTints[featured] : null;
  return (
    <div
      className={`rounded-[16px] border overflow-hidden ${
        full ? "col-span-full" : ""
      } ${
        tinted
          ? "bg-[color:var(--surface)]"
          : "border-[color:var(--hairline-2)] bg-[color:var(--surface)]"
      }`}
      style={
        ft
          ? {
              borderColor: ft.border,
              background: ft.gradient,
              boxShadow: ft.shadow,
            }
          : hero
          ? {
              borderColor: "rgba(234,67,53,.45)",
              background:
                "linear-gradient(135deg, rgba(234,67,53,.10), transparent 60%), var(--surface)",
            }
          : undefined
      }
    >
      <div
        className="px-5 py-3 border-b border-[color:var(--hairline)] flex items-center justify-between"
        style={
          ft
            ? { borderColor: ft.hairline }
            : hero
            ? { borderColor: "rgba(234,67,53,.25)" }
            : undefined
        }
      >
        <span
          className={`text-[11.5px] font-bold tracking-[0.14em] uppercase ${
            hero ? "text-[color:var(--down)]" : "text-[color:var(--text-2)]"
          }`}
          style={ft ? { color: ft.title } : undefined}
        >
          {hero ? "★ " : ""}
          {title}
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-[color:var(--text-3)]">
          {valueLabel}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-[color:var(--text-3)] text-[13px]">
          No data yet.
        </div>
      ) : (
        rows.map((p, i) => {
          const value = p[valueKey] as number;
          return (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="grid grid-cols-[28px_1fr_60px_60px_80px] max-sm:grid-cols-[28px_1fr_70px_80px] items-center gap-3 px-5 py-2.5 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] text-[14px]"
            >
              <span
                className={`font-[family-name:var(--mono)] num ${
                  i === 0 ? "text-[color:var(--brand-ink)] font-bold" : "text-[color:var(--text-3)]"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-bold truncate">
                {p.firstName} {p.lastName}
              </span>
              <span className="font-[family-name:var(--mono)] num text-[12px] text-[color:var(--text-3)] text-right">
                {p.wins}-{p.losses}
              </span>
              <span
                className={`font-[family-name:var(--mono)] num text-right max-sm:hidden ${
                  playedOf && playedOf > 0
                    ? "text-[13px] font-extrabold text-[color:var(--brand-ink)]"
                    : "text-[12px] text-[color:var(--text-3)]"
                }`}
              >
                {playedOf && playedOf > 0
                  ? `${Math.round((p.gamesPlayed / playedOf) * 100)}%`
                  : `${p.gamesPlayed} GP`}
              </span>
              <span
                className={`font-extrabold text-[13.5px] num text-right ${
                  hero
                    ? "text-[color:var(--down)]"
                    : negative
                    ? "text-[color:var(--down)]"
                    : isPercent && value >= 60
                    ? "text-[color:var(--up)]"
                    : isPercent && value < 40
                    ? "text-[color:var(--down)]"
                    : "text-[color:var(--text)]"
                }`}
              >
                {isPercent ? `${value.toFixed(1)}%` : value}
              </span>
            </Link>
          );
        })
      )}
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
    return qs ? `/leaderboard?${qs}` : "/leaderboard";
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

void Pill;
