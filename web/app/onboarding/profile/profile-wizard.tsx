"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile } from "@/lib/actions/profile";
import { AvatarUploader } from "@/components/bdl/avatar-uploader";

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

type Opt = { value: string; label: string };
const STATES: Opt[] = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
].map((s) => ({ value: s, label: s }));
const FT: Opt[] = [4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n} ft` }));
const INCHES: Opt[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: `${i} in`,
}));
const POSITIONS: Opt[] = [
  { value: "G", label: "Guard (G)" },
  { value: "F", label: "Forward (F)" },
  { value: "C", label: "Center (C)" },
  { value: "G/F", label: "Guard / Forward" },
  { value: "F/C", label: "Forward / Center" },
];
const SPORTS: Opt[] = [
  "Basketball","Volleyball","Pickleball","Soccer","Football","Other",
].map((s) => ({ value: s, label: s }));
const WEIGHTS: Opt[] = Array.from({ length: 53 }, (_, i) => {
  const w = 90 + i * 5; // 90 → 350
  return { value: String(w), label: `${w} lbs` };
});
const LEVELS: Opt[] = [
  "Rec","Middle school","High school","College","Semi-pro / Pro-am","Pro","Overseas",
].map((s) => ({ value: s, label: s }));

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

export function ProfileWizard({
  initial,
  playerId,
  avatarUrl,
  initials,
}: {
  initial: ProfileValues;
  playerId: string;
  avatarUrl: string | null;
  initials: string;
}) {
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

  const Select = (k: keyof ProfileValues, placeholder: string, opts: Opt[]) => {
    const cur = String(v[k]);
    return (
      <select
        value={cur}
        onChange={(e) => set(k, e.target.value)}
        className={`${field} ${cur === "" ? "text-[color:var(--text-3)]" : ""}`}
      >
        <option value="">{placeholder}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value} className="text-[color:var(--text)]">
            {o.label}
          </option>
        ))}
        {cur !== "" && !opts.some((o) => o.value === cur) && (
          <option value={cur}>{cur}</option>
        )}
      </select>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* headshot */}
      <div className="flex items-center gap-4">
        <AvatarUploader
          playerId={playerId}
          currentUrl={avatarUrl}
          initials={initials}
        />
        <div>
          <div className="text-[14px] font-bold tracking-[-0.01em]">
            Add a headshot
          </div>
          <div className="text-[12.5px] text-[color:var(--text-3)]">
            Completes your community profile (optional).
          </div>
        </div>
      </div>

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
        {Select("state", "State", STATES)}
        {Select("heightFt", "Height (ft)", FT)}
        {Select("heightIn", "Height (in)", INCHES)}
        {Select("weight", "Weight (lbs)", WEIGHTS)}
        {Select("position", "Position", POSITIONS)}
        {Input("zip", "Zip", { inputMode: "numeric" })}
        {Input("college", "College")}
        {Select("sport", "Sport", SPORTS)}
        {Select("highestLevel", "Highest level played", LEVELS)}
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
