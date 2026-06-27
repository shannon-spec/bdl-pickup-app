"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trophy, CalendarDays, Users2 } from "lucide-react";
import {
  createEvent,
  type CreateEventInput,
  type DivisionInput,
} from "@/lib/actions/organize";

type EventType = "LEAGUE" | "TOURNAMENT" | "COMMUNITY";

const field =
  "h-11 w-full rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[15px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]";
const label =
  "text-[11px] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-3)] mb-1.5 block";

const TYPES: { key: EventType; label: string; icon: React.ReactNode; sub: string }[] =
  [
    { key: "LEAGUE", label: "League", icon: <CalendarDays size={16} />, sub: "Recurring play" },
    { key: "TOURNAMENT", label: "Tournament", icon: <Trophy size={16} />, sub: "Bracket event" },
    { key: "COMMUNITY", label: "Community", icon: <Users2 size={16} />, sub: "Owns events" },
  ];

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const AGE_BANDS: { v: DivisionInput["ageBand"]; label: string }[] = [
  { v: "open", label: "Open" },
  { v: "youth", label: "Youth" },
  { v: "hs", label: "High school" },
  { v: "o35", label: "35+" },
  { v: "custom", label: "Custom" },
];
const TIERS = [
  "Any",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
] as const;

function newDivision(name = "Open"): DivisionInput {
  return { name, ageBand: "open", skillTier: null, cap: null };
}

export function NewEventForm({ initialType }: { initialType: EventType }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<EventType>(initialType);
  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");

  // league
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [playStyle, setPlayStyle] =
    useState<CreateEventInput["playStyle"]>("PICKUP_AUTOBALANCE");
  const [seasonLength, setSeasonLength] = useState("");

  // tournament
  const [teamSize, setTeamSize] = useState("5v5");
  const [bracketFormat, setBracketFormat] =
    useState<NonNullable<CreateEventInput["bracketFormat"]>>("SINGLE_ELIM");
  const [registrationMode, setRegistrationMode] =
    useState<NonNullable<CreateEventInput["registrationMode"]>>("OPEN");
  const [entryFee, setEntryFee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // community
  const [kind, setKind] = useState("frat");

  // divisions
  const [divisions, setDivisions] = useState<DivisionInput[]>([newDivision()]);

  const needsDivisions = type === "LEAGUE" || type === "TOURNAMENT";

  const toggleDay = (d: number) =>
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort(),
    );

  const setDiv = (i: number, patch: Partial<DivisionInput>) =>
    setDivisions((cur) => cur.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const submit = (publish: boolean) =>
    start(async () => {
      setError(null);
      if (!name.trim()) {
        setError("Give it a name.");
        return;
      }
      const input: CreateEventInput = {
        type,
        name: name.trim(),
        publish,
        venueName: venueName || undefined,
        venueAddress: venueAddress || undefined,
      };
      if (type === "LEAGUE") {
        input.days = days;
        input.startTime = startTime || undefined;
        input.playStyle = playStyle;
        input.seasonLength = seasonLength ? Number(seasonLength) : null;
        input.divisions = divisions;
      } else if (type === "TOURNAMENT") {
        input.teamSize = teamSize;
        input.bracketFormat = bracketFormat;
        input.registrationMode = registrationMode;
        input.entryFeeCents = entryFee
          ? Math.round(Number(entryFee) * 100)
          : null;
        input.startDate = startDate || null;
        input.endsAt = endsAt || null;
        input.divisions = divisions;
      } else {
        input.kind = kind;
      }
      const res = await createEvent(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(res.data.href);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6 max-w-[560px]">
      <h1 className="text-[24px] font-extrabold tracking-[-0.03em]">
        Create an event
      </h1>

      {/* type selector */}
      <div className="grid grid-cols-3 gap-2">
        {TYPES.map((t) => {
          const on = type === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`flex flex-col items-start gap-1 rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
                on
                  ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]"
                  : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)]"
              }`}
            >
              <span
                className={
                  on
                    ? "text-[color:var(--brand-ink)]"
                    : "text-[color:var(--text-3)]"
                }
              >
                {t.icon}
              </span>
              <span className="text-[13px] font-bold leading-none">{t.label}</span>
              <span className="text-[10.5px] text-[color:var(--text-3)] leading-none">
                {t.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* basics */}
      <div>
        <label className={label}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            type === "TOURNAMENT"
              ? "Sig Ep Summer Classic"
              : type === "COMMUNITY"
                ? "Sigma Phi Epsilon"
                : "CPA Morning League"
          }
          className={field}
          autoFocus
        />
      </div>

      {type !== "COMMUNITY" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Venue name</label>
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Main Gym"
              className={field}
            />
          </div>
          <div>
            <label className={label}>Address</label>
            <input
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="123 Court St"
              className={field}
            />
          </div>
        </div>
      )}

      {/* ---- LEAGUE format ---- */}
      {type === "LEAGUE" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className={label}>Days</label>
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-9 h-9 rounded-full text-[13px] font-bold transition-colors ${
                      on
                        ? "bg-[color:var(--brand)] text-white"
                        : "bg-[color:var(--surface-2)] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Season length (wks)</label>
              <input
                type="number"
                inputMode="numeric"
                value={seasonLength}
                onChange={(e) => setSeasonLength(e.target.value)}
                placeholder="10"
                className={field}
              />
            </div>
          </div>
          <div>
            <label className={label}>Play style</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["PICKUP_AUTOBALANCE", "Pickup — auto-balanced"],
                  ["FIXED_TEAMS", "Fixed teams"],
                ] as const
              ).map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPlayStyle(v)}
                  className={`h-11 rounded-[var(--r-lg)] text-[13px] font-semibold border transition-colors ${
                    playStyle === v
                      ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]"
                      : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TOURNAMENT format ---- */}
      {type === "TOURNAMENT" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Team size</label>
              <select
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className={field}
              >
                <option value="5v5">5v5</option>
                <option value="3v3">3v3</option>
              </select>
            </div>
            <div>
              <label className={label}>Format</label>
              <select
                value={bracketFormat}
                onChange={(e) =>
                  setBracketFormat(
                    e.target.value as typeof bracketFormat,
                  )
                }
                className={field}
              >
                <option value="SINGLE_ELIM">Single elimination</option>
                <option value="DOUBLE_ELIM">Double elimination</option>
                <option value="ROUND_ROBIN">Round robin</option>
                <option value="POOL_TO_BRACKET">Pools → bracket</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Registration</label>
              <select
                value={registrationMode}
                onChange={(e) =>
                  setRegistrationMode(
                    e.target.value as typeof registrationMode,
                  )
                }
                className={field}
              >
                <option value="OPEN">Open</option>
                <option value="INVITE">Invite only</option>
              </select>
            </div>
            <div>
              <label className={label}>Entry fee ($)</label>
              <input
                type="number"
                inputMode="decimal"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                placeholder="0"
                className={field}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Starts</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Ends</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={field}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---- COMMUNITY ---- */}
      {type === "COMMUNITY" && (
        <div>
          <label className={label}>Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={field}
          >
            <option value="frat">Fraternity</option>
            <option value="campus">Campus</option>
            <option value="gym">Gym</option>
            <option value="club">Club</option>
            <option value="other">Other</option>
          </select>
          <p className="text-[12px] text-[color:var(--text-3)] mt-2">
            A community owns multiple leagues and tournaments. You can add events
            to it after it&apos;s created.
          </p>
        </div>
      )}

      {/* ---- Divisions ---- */}
      {needsDivisions && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${label} mb-0`}>Divisions</label>
            <button
              type="button"
              onClick={() => setDivisions((c) => [...c, newDivision("")])}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--brand)]"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {divisions.map((d, i) => (
              <div
                key={i}
                className="rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-2.5 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={d.name}
                    onChange={(e) => setDiv(i, { name: e.target.value })}
                    placeholder="Division name"
                    className={`${field} h-10`}
                  />
                  {divisions.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDivisions((c) => c.filter((_, j) => j !== i))
                      }
                      className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-[var(--r-lg)] text-[color:var(--text-3)] hover:text-[color:var(--down)]"
                      aria-label="Remove division"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={d.ageBand}
                    onChange={(e) =>
                      setDiv(i, {
                        ageBand: e.target.value as DivisionInput["ageBand"],
                      })
                    }
                    className={`${field} h-10 text-[13px]`}
                  >
                    {AGE_BANDS.map((a) => (
                      <option key={a.v} value={a.v}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={d.skillTier ?? "Any"}
                    onChange={(e) =>
                      setDiv(i, {
                        skillTier:
                          e.target.value === "Any"
                            ? null
                            : (e.target.value as DivisionInput["skillTier"]),
                      })
                    }
                    className={`${field} h-10 text-[13px]`}
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={d.cap ?? ""}
                    onChange={(e) =>
                      setDiv(i, {
                        cap: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Cap"
                    className={`${field} h-10 text-[13px]`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="text-[13px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      {/* actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(true)}
          className="flex-1 h-12 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create & publish"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(false)}
          className="h-12 px-4 rounded-[12px] bg-[color:var(--surface)] text-[12px] font-bold text-[color:var(--text-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:bg-[color:var(--surface-2)] disabled:opacity-60"
        >
          Save draft
        </button>
      </div>
    </div>
  );
}
