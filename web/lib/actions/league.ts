"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leagues, scheduleSlots } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Generate season "nights" from the league cadence (days + time × weeks). */
export async function generateLeagueSchedule(
  leagueId: string,
  opts?: { startDate?: string; weeks?: number },
): Promise<ActionResult<{ slots: number }>> {
  const session = await readSession();
  if (!(await canManageLeague(session, leagueId)))
    return { ok: false, error: "Not allowed." };

  const [lg] = await db
    .select({
      days: leagues.days,
      startTime: leagues.startTime,
      seasonLength: leagues.seasonLength,
      startDate: leagues.startDate,
      venueName: leagues.venueName,
    })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);
  if (!lg) return { ok: false, error: "League not found." };

  const days = ((lg.days as number[] | null) ?? []).filter(
    (d) => d >= 0 && d <= 6,
  );
  if (!days.length)
    return { ok: false, error: "Set the league's play days first (Settings)." };

  const weeks = Math.max(1, Math.min(opts?.weeks ?? lg.seasonLength ?? 8, 52));
  const startStr =
    opts?.startDate || lg.startDate || new Date().toISOString().slice(0, 10);
  const time = (lg.startTime || "18:00").slice(0, 5);
  const [hh, mm] = time.split(":").map((x) => Number(x));

  const base = new Date(`${startStr}T00:00:00`);
  const slots: {
    contextType: "LEAGUE";
    contextId: string;
    court: string | null;
    startsAt: Date;
  }[] = [];
  for (const d of days) {
    const first = new Date(base);
    first.setDate(first.getDate() + ((d - first.getDay() + 7) % 7));
    for (let w = 0; w < weeks; w++) {
      const dt = new Date(first);
      dt.setDate(dt.getDate() + 7 * w);
      dt.setHours(Number.isNaN(hh) ? 18 : hh, Number.isNaN(mm) ? 0 : mm, 0, 0);
      slots.push({
        contextType: "LEAGUE",
        contextId: leagueId,
        court: lg.venueName || null,
        startsAt: dt,
      });
    }
  }
  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  await db
    .delete(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.contextType, "LEAGUE"),
        eq(scheduleSlots.contextId, leagueId),
      ),
    );
  if (slots.length) await db.insert(scheduleSlots).values(slots);

  revalidatePath(`/manage/league/${leagueId}`);
  return { ok: true, data: { slots: slots.length } };
}

export async function clearLeagueSchedule(
  leagueId: string,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!(await canManageLeague(session, leagueId)))
    return { ok: false, error: "Not allowed." };
  await db
    .delete(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.contextType, "LEAGUE"),
        eq(scheduleSlots.contextId, leagueId),
      ),
    );
  revalidatePath(`/manage/league/${leagueId}`);
  return { ok: true, data: null };
}
