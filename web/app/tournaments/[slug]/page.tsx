import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import {
  getPublicTournament,
  type ManageDivision,
  type RegRow,
} from "@/lib/queries/organize";
import { Brand } from "@/components/bdl/brand";
import { LeagueAvatar } from "@/components/bdl/league-avatar";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getPublicTournament(slug);
  return { title: t ? `${t.name} · BDL` : "Tournament · BDL" };
}

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() ||
    "•"
  );
}

type Standing = { id: string; label: string; w: number; l: number; diff: number };

function standings(div: ManageDivision): Standing[] {
  const label = new Map(div.registrations.map((r) => [r.id, r.label]));
  const tbl = new Map<string, Standing>();
  const ensure = (id: string) => {
    if (!tbl.has(id))
      tbl.set(id, { id, label: label.get(id) ?? "—", w: 0, l: 0, diff: 0 });
    return tbl.get(id)!;
  };
  for (const m of div.matches) {
    if (
      m.homeRegistrationId &&
      m.awayRegistrationId &&
      m.homeScore != null &&
      m.awayScore != null
    ) {
      const h = ensure(m.homeRegistrationId);
      const a = ensure(m.awayRegistrationId);
      h.diff += m.homeScore - m.awayScore;
      a.diff += m.awayScore - m.homeScore;
      if (m.homeScore > m.awayScore) {
        h.w++;
        a.l++;
      } else {
        a.w++;
        h.l++;
      }
    }
  }
  return [...tbl.values()].sort((x, y) => y.w - x.w || y.diff - x.diff);
}

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  const session = await readSession();

  return (
    <main className="min-h-[100dvh] bg-[color:var(--bg)]">
      <div className="mx-auto max-w-[760px] px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="BDL home">
            <Brand height={30} />
          </Link>
          {session ? (
            <Link
              href={`/manage/tournament/${t.id}`}
              className="text-[13px] font-bold text-[color:var(--brand)] hover:underline"
            >
              Manage
            </Link>
          ) : (
            <Link
              href="https://www.bdlpickup.com/login"
              className="inline-flex items-center h-9 px-4 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-bold hover:bg-[color:var(--surface-2)]"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* header */}
        <div className="flex items-center gap-3.5">
          <LeagueAvatar
            kind={t.avatarKind}
            color={t.avatarColor}
            emoji={t.avatarEmoji}
            abbr={initials(t.name)}
            size={52}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em] truncate">
              {t.name}
            </h1>
            <div className="text-[13px] text-[color:var(--text-3)]">
              {t.teamSize ?? "5v5"} · {prettyFormat(t.bracketFormat)}
              {t.entryFeeCents
                ? ` · $${(t.entryFeeCents / 100).toFixed(0)} entry`
                : " · Free"}
            </div>
          </div>
          {t.registrationMode === "OPEN" && (
            <Link
              href={`https://www.bdlpickup.com/login?next=/tournaments/${t.slug}`}
              className="shrink-0 inline-flex items-center h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em] hover:bg-[color:var(--brand-hover)]"
            >
              Register
            </Link>
          )}
        </div>

        {t.divisions.length === 0 && (
          <p className="text-[14px] text-[color:var(--text-3)]">
            Divisions and the bracket will appear here once the organizer sets
            them up.
          </p>
        )}

        {t.divisions.map((div) => (
          <DivisionBlock key={div.id} div={div} />
        ))}
      </div>
    </main>
  );
}

function prettyFormat(f: string | null) {
  switch (f) {
    case "SINGLE_ELIM":
      return "Single elimination";
    case "DOUBLE_ELIM":
      return "Double elimination";
    case "ROUND_ROBIN":
      return "Round robin";
    case "POOL_TO_BRACKET":
      return "Pools → bracket";
    default:
      return "Bracket";
  }
}

function DivisionBlock({ div }: { div: ManageDivision }) {
  const label = new Map(div.registrations.map((r) => [r.id, r.label]));
  const labelOf = (id: string | null) => (id ? (label.get(id) ?? "TBD") : "—");
  const table = standings(div);

  const finals = div.matches.filter(
    (m) => m.nextMatchId === null && (m.bracketGroup === null || m.bracketGroup === "GF" || m.bracketGroup === "B"),
  );
  const champ = finals.find((m) => m.winnerRegistrationId)?.winnerRegistrationId;

  // group matches by bracket_group then round for a read-only results list
  const groups = new Map<string, typeof div.matches>();
  for (const m of div.matches) {
    const k = m.bracketGroup ?? "_";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }
  const groupOrder = [...groups.keys()].sort((a, b) => {
    const rank = (g: string) =>
      g.startsWith("P") ? 0 : g === "_" ? 1 : g === "W" ? 2 : g === "L" ? 3 : g === "B" ? 4 : 5;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const groupName = (g: string, i: number) =>
    g.startsWith("P")
      ? `Pool ${String.fromCharCode(65 + i)}`
      : g === "W"
        ? "Winners"
        : g === "L"
          ? "Losers"
          : g === "GF"
            ? "Grand final"
            : g === "B"
              ? "Playoffs"
              : "Schedule";

  return (
    <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold tracking-[-0.01em]">
          {div.name}
        </h2>
        <span className="text-[12px] text-[color:var(--text-3)]">
          {div.registrations.filter((r) => r.status === "confirmed").length} teams
        </span>
      </div>

      {champ && (
        <div className="flex items-center gap-2 rounded-[12px] bg-[color:var(--up-soft)] px-3.5 py-2.5">
          <Trophy size={16} className="text-[color:var(--up)]" />
          <span className="text-[13.5px] font-bold">
            {labelOf(champ)} — Champion
          </span>
        </div>
      )}

      {div.matches.length === 0 ? (
        <Teams regs={div.registrations} />
      ) : (
        <>
          {table.length > 0 && (
            <div className="rounded-[12px] border border-[color:var(--hairline-2)] overflow-hidden text-[13px]">
              <div className="grid grid-cols-[28px_1fr_56px_56px] gap-2 px-3 py-2 bg-[color:var(--surface-2)] text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-3)]">
                <span>#</span>
                <span>Team</span>
                <span className="text-center">W-L</span>
                <span className="text-center">Diff</span>
              </div>
              {table.map((s, i) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[28px_1fr_56px_56px] gap-2 px-3 py-2 border-t border-[color:var(--hairline)] items-center"
                >
                  <span className="text-[color:var(--text-3)]">{i + 1}</span>
                  <span className="font-semibold truncate">{s.label}</span>
                  <span className="text-center tabular-nums">
                    {s.w}-{s.l}
                  </span>
                  <span className="text-center tabular-nums text-[color:var(--text-2)]">
                    {s.diff > 0 ? `+${s.diff}` : s.diff}
                  </span>
                </div>
              ))}
            </div>
          )}

          {groupOrder.map((g, gi) => {
            const ms = groups
              .get(g)!
              .slice()
              .sort((a, b) => a.round - b.round || a.slot - b.slot);
            return (
              <div key={g}>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)] mb-1.5">
                  {groupName(g, gi)}
                </p>
                <div className="flex flex-col gap-1.5">
                  {ms.map((m) => {
                    const hw = m.winnerRegistrationId === m.homeRegistrationId;
                    const aw = m.winnerRegistrationId === m.awayRegistrationId;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center text-[13px] rounded-[10px] border border-[color:var(--hairline-2)] px-3 py-2"
                      >
                        <span
                          className={`flex-1 truncate ${hw ? "font-extrabold" : "text-[color:var(--text-2)]"}`}
                        >
                          {labelOf(m.homeRegistrationId)}
                        </span>
                        <span className="px-2 tabular-nums text-[color:var(--text-3)]">
                          {m.homeScore ?? "–"} : {m.awayScore ?? "–"}
                        </span>
                        <span
                          className={`flex-1 truncate text-right ${aw ? "font-extrabold" : "text-[color:var(--text-2)]"}`}
                        >
                          {labelOf(m.awayRegistrationId)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

function Teams({ regs }: { regs: RegRow[] }) {
  if (regs.length === 0)
    return (
      <p className="text-[13px] text-[color:var(--text-3)]">
        No teams registered yet.
      </p>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {regs.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center h-7 px-3 rounded-full bg-[color:var(--surface-2)] text-[12.5px] font-medium"
        >
          {r.label}
        </span>
      ))}
    </div>
  );
}
