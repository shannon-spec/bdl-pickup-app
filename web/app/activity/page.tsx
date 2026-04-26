import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { db, games } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity · BDL" };

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}, ${dt.getFullYear()}`;
};

export default async function ActivityPage() {
  const session = await readSession();
  if (!session) redirect("/discover");

  const all = await db.select().from(games).orderBy(desc(games.gameDate));

  const events: { gameId: string; date: string; type: "result" | "scheduled"; text: string; winner?: string }[] = [];
  for (const g of all) {
    if (!g.gameDate) continue;
    const isComplete =
      (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;
    if (isComplete) {
      const win =
        g.winTeam ??
        (g.scoreA !== null && g.scoreB !== null
          ? g.scoreA > g.scoreB
            ? "A"
            : g.scoreB > g.scoreA
              ? "B"
              : "Tie"
          : null);
      if (!win || win === "Tie") continue;
      const winnerTeam = win === "A" ? g.teamAName ?? "White" : g.teamBName ?? "Dark";
      const loserTeam = win === "A" ? g.teamBName ?? "Dark" : g.teamAName ?? "White";
      const winnerScore = win === "A" ? g.scoreA : g.scoreB;
      const loserScore = win === "A" ? g.scoreB : g.scoreA;
      events.push({
        gameId: g.id,
        date: g.gameDate,
        type: "result",
        text: `${winnerTeam} beat ${loserTeam} ${winnerScore ?? "?"}–${loserScore ?? "?"}${g.leagueName ? ` · ${g.leagueName}` : ""}`,
        winner: winnerTeam,
      });
    } else {
      events.push({
        gameId: g.id,
        date: g.gameDate,
        type: "scheduled",
        text: `${g.teamAName ?? "White"} vs ${g.teamBName ?? "Dark"} scheduled${g.leagueName ? ` · ${g.leagueName}` : ""}`,
      });
    }
  }

  // Group by date
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const dates = Array.from(byDate.keys()).sort().reverse();

  return (
    <>
      <TopBar
        active="/activity"
        userInitials={session.username.slice(0, 2).toUpperCase()}
      />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Activity"
          count={
            <span>
              {events.length} event{events.length === 1 ? "" : "s"}
            </span>
          }
        />

        {events.length === 0 ? (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            No activity yet.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {dates.map((date) => (
              <div key={date}>
                <div className="sticky top-[72px] z-[5] bg-[color:var(--bg)] py-2 mb-2 text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
                  {fmtDate(date)}
                </div>
                <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
                  {byDate.get(date)!.map((e) => (
                    <Link
                      key={e.gameId + e.type}
                      href={`/games/${e.gameId}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] text-[14px]"
                    >
                      <span className="text-[color:var(--text)]">{e.text}</span>
                      {e.type === "result" ? (
                        <Pill tone="win" dot>
                          Final
                        </Pill>
                      ) : (
                        <Pill tone="neutral">Upcoming</Pill>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
