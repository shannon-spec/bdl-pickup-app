import Link from "next/link";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { getActivityEvents } from "@/lib/queries/activity";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity · BDL" };

const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}, ${dt.getFullYear()}`;
};

export default async function ActivityPage() {
  const events = await getActivityEvents();

  // Group by date (events are already sorted desc by gameDate + sub-order).
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const dates = Array.from(byDate.keys());

  return (
    <>
      <TopBar active="/activity" />
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
                      key={e.id}
                      href={e.href}
                      className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] text-[14px]"
                    >
                      <span className="text-[color:var(--text)]">{e.text}</span>
                      <Pill tone={e.pill.tone} dot={e.pill.dot}>
                        {e.pill.label}
                      </Pill>
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
