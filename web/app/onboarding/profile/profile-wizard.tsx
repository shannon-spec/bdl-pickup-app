"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile } from "@/lib/actions/profile";

export type ProfileValues = {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  zip: string;
  college: string;
  sport: string;
  position: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  highestLevel: string;
  level:
    | "Not Rated"
    | "Novice"
    | "Intermediate"
    | "Advanced"
    | "Game Changer"
    | "Pro";
};

const field =
  "h-11 w-full rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[15px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]";

// Fields that count toward the completion bar.
const PROGRESS_KEYS: (keyof ProfileValues)[] = [
  "firstName",
  "lastName",
  "city",
  "state",
  "heightFt",
  "weight",
  "position",
  "college",
  "sport",
  "highestLevel",
];

export function ProfileWizard({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<ProfileValues>(initial);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof ProfileValues, val: string) =>
    setV((cur) => ({ ...cur, [k]: val }));

  const pct = useMemo(() => {
    const filled = PROGRESS_KEYS.filter((k) => String(v[k]).trim() !== "").length;
    return Math.round((filled / PROGRESS_KEYS.length) * 100);
  }, [v]);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await updateMyProfile(v);
      if (!res.ok) return setError(res.error);
      router.push("/discover");
      router.refresh();
    });

  const Input = (
    k: keyof ProfileValues,
    placeholder: string,
    extra?: { inputMode?: "numeric"; maxLength?: number },
  ) => (
    <input
      value={v[k]}
      onChange={(e) => set(k, e.target.value)}
      placeholder={placeholder}
      className={field}
      inputMode={extra?.inputMode}
      maxLength={extra?.maxLength}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-[color:var(--surface-2)] overflow-hidden">
          <div
            className="h-full bg-[color:var(--brand)] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[12px] font-bold text-[color:var(--text-2)] tabular-nums w-9 text-right">
          {pct}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {Input("firstName", "First name")}
        {Input("lastName", "Last name")}
        {Input("city", "City")}
        {Input("state", "State", { maxLength: 2 })}
        {Input("heightFt", "Height ft", { inputMode: "numeric" })}
        {Input("heightIn", "Height in", { inputMode: "numeric" })}
        {Input("weight", "Weight (lbs)", { inputMode: "numeric" })}
        {Input("position", "Position (G / F / C)")}
        {Input("zip", "Zip", { inputMode: "numeric" })}
        {Input("college", "College")}
        {Input("sport", "Sport")}
        {Input("highestLevel", "Highest level played")}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-3)]">
          Self-grade
        </span>
        <select
          value={v.level}
          onChange={(e) => set("level", e.target.value as ProfileValues["level"])}
          className={field}
        >
          <option value="Not Rated">Not rated</option>
          <option value="Novice">Novice</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
          <option value="Game Changer">Game Changer</option>
          <option value="Pro">Pro</option>
        </select>
      </label>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !v.firstName.trim()}
        className="h-12 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase disabled:opacity-60"
      >
        {pending ? "Saving…" : "Join BDL — continue to discover"}
      </button>
      <p className="text-[12px] text-[color:var(--text-3)] text-center">
        You can edit this anytime from your profile.
      </p>
    </div>
  );
}
