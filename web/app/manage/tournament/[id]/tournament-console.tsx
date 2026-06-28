"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Trophy, Check } from "lucide-react";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import {
  addRegistration,
  removeRegistration,
  generateBracket,
  enterMatchScore,
} from "@/lib/actions/bracket";
import type {
  ManageTournament,
  ManageDivision,
  MatchRow,
} from "@/lib/queries/organize";

const TABS = ["Overview", "Registration", "Bracket", "Settings"] as const;
type Tab = (typeof TABS)[number];

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() ||
    "•"
  );
}

export function TournamentConsole({ t }: { t: ManageTournament }) {
  const [tab, setTab] = useState<Tab>(
    t.divisions.some((d) => d.matches.length) ? "Bracket" : "Overview",
  );
  const [divId, setDivId] = useState<string>(t.divisions[0]?.id ?? "");
  const div = t.divisions.find((d) => d.id === divId) ?? t.divisions[0];

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <LeagueAvatar
          kind={t.avatarKind}
          color={t.avatarColor}
          emoji={t.avatarEmoji}
          abbr={initials(t.name)}
          size={44}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] truncate">
            {t.name}
          </h1>
          <div className="text-[12.5px] text-[color:var(--text-3)]">
            {t.teamSize ?? "5v5"} · {prettyFormat(t.bracketFormat)}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold ${
            t.published
              ? "bg-[color:var(--up-soft)] text-[color:var(--up)]"
              : "bg-[color:var(--surface-2)] text-[color:var(--text-3)]"
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: t.published ? "var(--up)" : "var(--text-4)" }}
          />
          {t.published ? "Published" : "Draft"}
          {t.registrationMode === "OPEN" ? " · Reg open" : ""}
        </span>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-[color:var(--hairline)] -mb-px overflow-x-auto">
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setTab(x)}
            className={`px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors ${
              tab === x
                ? "border-[color:var(--brand)] text-[color:var(--text)]"
                : "border-transparent text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      {/* division picker (registration + bracket) */}
      {(tab === "Registration" || tab === "Bracket") && t.divisions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {t.divisions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDivId(d.id)}
              className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${
                d.id === divId
                  ? "bg-[color:var(--brand)] text-white"
                  : "bg-[color:var(--surface-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {tab === "Overview" && <Overview t={t} />}
      {tab === "Registration" && div && (
        <Registration tournamentId={t.id} div={div} />
      )}
      {tab === "Bracket" && div && <Bracket tournamentId={t.id} div={div} />}
      {tab === "Settings" && <Settings t={t} />}
    </div>
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

/* ---------- Overview ---------- */
function Overview({ t }: { t: ManageTournament }) {
  const totalTeams = t.divisions.reduce(
    (s, d) => s + d.registrations.filter((r) => r.status === "confirmed").length,
    0,
  );
  const stats = [
    { label: "Divisions", value: t.divisions.length },
    { label: "Confirmed teams", value: totalTeams },
    {
      label: "Entry fee",
      value: t.entryFeeCents ? `$${(t.entryFeeCents / 100).toFixed(0)}` : "Free",
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[14px] bg-[color:var(--surface-2)] p-3.5"
          >
            <div className="text-[22px] font-extrabold tracking-[-0.02em]">
              {s.value}
            </div>
            <div className="text-[11px] text-[color:var(--text-3)] mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>
      {t.divisions.length === 0 && (
        <p className="text-[13px] text-[color:var(--text-3)]">
          No divisions yet. Add divisions when you create the event.
        </p>
      )}
    </div>
  );
}

/* ---------- Registration ---------- */
function Registration({
  tournamentId,
  div,
}: {
  tournamentId: string;
  div: ManageDivision;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () =>
    start(async () => {
      setError(null);
      const res = await addRegistration(tournamentId, div.id, name);
      if (!res.ok) return setError(res.error);
      setName("");
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      await removeRegistration(tournamentId, id);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && add()}
          placeholder="Team name"
          className="h-11 flex-1 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[15px] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !name.trim()}
          className="h-11 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white font-bold text-[13px] inline-flex items-center gap-1 disabled:opacity-60"
        >
          <Plus size={16} /> Add
        </button>
      </div>
      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
      {div.registrations.length === 0 ? (
        <p className="text-[13px] text-[color:var(--text-3)]">
          No teams yet. Add teams, then generate the bracket.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {div.registrations.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-[12px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-3 py-2.5"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[color:var(--surface-2)] text-[12px] font-bold text-[color:var(--text-2)] shrink-0">
                {r.seed ?? "–"}
              </span>
              <span className="flex-1 min-w-0 font-semibold text-[14px] truncate">
                {r.label}
              </span>
              <span className="text-[11px] text-[color:var(--text-3)] capitalize">
                {r.status}
              </span>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={pending}
                className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full text-[color:var(--text-3)] hover:text-[color:var(--down)]"
                aria-label="Remove"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Bracket ---------- */
function Bracket({
  tournamentId,
  div,
}: {
  tournamentId: string;
  div: ManageDivision;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const labelOf = useMemo(() => {
    const m = new Map(div.registrations.map((r) => [r.id, r]));
    return (id: string | null) =>
      id ? (m.get(id)?.label ?? "TBD") : null;
  }, [div.registrations]);

  const seedOf = useMemo(() => {
    const m = new Map(div.registrations.map((r) => [r.id, r.seed]));
    return (id: string | null) => (id ? (m.get(id) ?? null) : null);
  }, [div.registrations]);

  const rounds = useMemo(() => {
    const max = div.matches.reduce((mx, m) => Math.max(mx, m.round), 0);
    const cols: MatchRow[][] = [];
    for (let r = 1; r <= max; r++) {
      cols.push(
        div.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot),
      );
    }
    return cols;
  }, [div.matches]);

  const champion = useMemo(() => {
    const final = div.matches.find((m) => m.nextMatchId === null);
    return final?.winnerRegistrationId
      ? labelOf(final.winnerRegistrationId)
      : null;
  }, [div.matches, labelOf]);

  const generate = () =>
    start(async () => {
      setError(null);
      const res = await generateBracket(tournamentId, div.id);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  if (div.matches.length === 0) {
    return (
      <div className="rounded-[14px] bg-[color:var(--surface-2)] p-7 text-center flex flex-col items-center gap-3">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
          <Trophy size={18} />
        </span>
        <p className="text-[13.5px] text-[color:var(--text-2)] max-w-[360px]">
          Seed your confirmed teams, then generate the bracket. Enter a score and
          the next round fills itself.
        </p>
        {error && (
          <div className="text-[12px] text-[color:var(--down)]">{error}</div>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em] disabled:opacity-60"
        >
          {pending ? "Generating…" : "Generate bracket"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)]">
          {div.name} — generated bracket
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="text-[12px] font-semibold text-[color:var(--text-3)] hover:text-[color:var(--text)] disabled:opacity-60"
        >
          Re-seed
        </button>
      </div>

      {champion && (
        <div className="flex items-center gap-2 rounded-[12px] bg-[color:var(--up-soft)] px-3.5 py-2.5">
          <Trophy size={16} className="text-[color:var(--up)]" />
          <span className="text-[13.5px] font-bold text-[color:var(--text)]">
            {champion} — Champion
          </span>
        </div>
      )}

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((col, ri) => (
          <div
            key={ri}
            className="flex flex-col justify-around gap-3 min-w-[200px]"
          >
            {col.map((m) => (
              <MatchBox
                key={m.id}
                tournamentId={tournamentId}
                m={m}
                labelOf={labelOf}
                seedOf={seedOf}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchBox({
  tournamentId,
  m,
  labelOf,
  seedOf,
}: {
  tournamentId: string;
  m: MatchRow;
  labelOf: (id: string | null) => string | null;
  seedOf: (id: string | null) => number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [home, setHome] = useState(m.homeScore?.toString() ?? "");
  const [away, setAway] = useState(m.awayScore?.toString() ?? "");
  const [err, setErr] = useState(false);

  const ready = !!m.homeRegistrationId && !!m.awayRegistrationId;
  const dirty =
    home !== (m.homeScore?.toString() ?? "") ||
    away !== (m.awayScore?.toString() ?? "");

  const save = () =>
    start(async () => {
      setErr(false);
      const h = Number(home);
      const a = Number(away);
      if (home === "" || away === "" || Number.isNaN(h) || Number.isNaN(a) || h === a) {
        setErr(true);
        return;
      }
      const res = await enterMatchScore(tournamentId, m.id, h, a);
      if (!res.ok) {
        setErr(true);
        return;
      }
      router.refresh();
    });

  const Row = ({
    regId,
    score,
    setScore,
  }: {
    regId: string | null;
    score: string;
    setScore: (v: string) => void;
  }) => {
    const isWinner = m.winnerRegistrationId && regId === m.winnerRegistrationId;
    const lbl = labelOf(regId);
    const seed = seedOf(regId);
    return (
      <div className="flex items-center gap-2 px-2.5 h-9">
        <span className="text-[11px] text-[color:var(--text-4)] w-3 shrink-0">
          {seed ?? ""}
        </span>
        <span
          className={`flex-1 min-w-0 truncate text-[13px] ${
            isWinner ? "font-extrabold text-[color:var(--text)]" : "text-[color:var(--text-2)]"
          }`}
        >
          {lbl ?? "—"}
        </span>
        {ready ? (
          <input
            value={score}
            onChange={(e) => setScore(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="w-9 h-7 text-center text-[13px] rounded-[6px] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] outline-none focus:border-[color:var(--brand)]"
          />
        ) : (
          <span className="w-9 text-center text-[13px] text-[color:var(--text-4)]">
            —
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`rounded-[10px] border bg-[color:var(--surface)] divide-y divide-[color:var(--hairline)] ${
        err ? "border-[color:var(--down)]" : "border-[color:var(--hairline-2)]"
      }`}
    >
      <Row regId={m.homeRegistrationId} score={home} setScore={setHome} />
      <Row regId={m.awayRegistrationId} score={away} setScore={setAway} />
      {ready && dirty && (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="w-full h-7 inline-flex items-center justify-center gap-1 text-[11px] font-bold text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)] disabled:opacity-60"
        >
          <Check size={13} /> Save
        </button>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */
function Settings({ t }: { t: ManageTournament }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[12px] bg-[color:var(--surface-2)] p-4">
        <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)] mb-1">
          Visibility
        </div>
        <div className="text-[14px] font-semibold">
          {t.published ? "Published — public page is live" : "Draft — not public yet"}
        </div>
        {t.slug && (
          <Link
            href={`/t/${t.slug}`}
            className="inline-block mt-2 text-[13px] font-semibold text-[color:var(--brand)] hover:underline"
          >
            /t/{t.slug}
          </Link>
        )}
      </div>
      <p className="text-[12.5px] text-[color:var(--text-3)]">
        Schedule, results, and people tools are coming next.
      </p>
    </div>
  );
}
