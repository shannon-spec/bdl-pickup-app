"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import type { Player } from "@/lib/db";
import { setPlayerHidden, updatePlayer } from "@/lib/actions/roster";

const POSITIONS = ["", "PG", "SG", "SF", "PF", "C", "G", "F"];
const GRADES = ["Not Rated", "Novice", "Intermediate", "Advanced", "Game Changer", "Pro"];
const STATUSES = ["Active", "Inactive", "IR"];
const HIGHEST_LEVELS = ["", "Pro", "College", "High School", "N/A"];

export function EditPlayerForm({ player }: { player: Player }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const [confirmHide, setConfirmHide] = useState(false);
  const [hiding, startHide] = useTransition();
  const isHidden = player.hiddenAt != null;

  const onSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = await updatePlayer(player.id, formData);
      if (res.ok) {
        router.push(`/players/${player.id}`);
        router.refresh();
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  };

  const onToggleHidden = () => {
    setConfirmHide(false);
    startHide(async () => {
      const res = await setPlayerHidden(player.id, !isHidden);
      if (res.ok) {
        // Hiding sends the admin back to the roster (player is gone
        // from the list); unhiding stays put so they can keep editing.
        if (!isHidden) {
          router.push("/players");
        }
        router.refresh();
      }
    });
  };

  return (
    <>
      <form action={onSubmit} className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 max-sm:p-4 flex flex-col gap-5">
        <Section title="Identity">
          <Row>
            <Field label="First Name *" error={fieldErrors.firstName?.[0]}>
              <input
                name="firstName"
                defaultValue={player.firstName}
                required
                autoFocus
                className={inputCx}
              />
            </Field>
            <Field label="Last Name *" error={fieldErrors.lastName?.[0]}>
              <input
                name="lastName"
                defaultValue={player.lastName}
                required
                className={inputCx}
              />
            </Field>
          </Row>
        </Section>

        <Section title="Contact">
          <PrivacyNote>
            Your cell and email are stored privately. They&apos;re only used
            for league-related contact (game invites, password resets, etc.)
            and will <strong>never</strong> appear on your public profile or
            be shared with other players.
          </PrivacyNote>
          <Field label="Email" error={fieldErrors.email?.[0]}>
            <input
              name="email"
              type="email"
              defaultValue={player.email ?? ""}
              className={inputCx}
              placeholder="player@example.com"
            />
          </Field>
          <Field label="Cell" error={fieldErrors.cell?.[0]}>
            <input
              name="cell"
              defaultValue={player.cell ?? ""}
              className={inputCx}
              placeholder="555-555-5555"
            />
          </Field>
          <div className="grid grid-cols-[2fr_1fr_1.2fr] gap-3 max-sm:grid-cols-1">
            <Field label="City" error={fieldErrors.city?.[0]}>
              <input name="city" defaultValue={player.city ?? ""} className={inputCx} />
            </Field>
            <Field label="State" hint="2 letters" error={fieldErrors.state?.[0]}>
              <input
                name="state"
                defaultValue={player.state ?? ""}
                maxLength={2}
                className={inputCx}
                style={{ textTransform: "uppercase" }}
              />
            </Field>
            <Field label="ZIP" error={fieldErrors.zip?.[0]}>
              <input
                name="zip"
                defaultValue={player.zip ?? ""}
                inputMode="numeric"
                className={inputCx}
                placeholder="37205"
              />
            </Field>
          </div>
        </Section>

        <Section title="Physical">
          <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-3 max-sm:grid-cols-1">
            <Field label="Height — ft" error={fieldErrors.heightFt?.[0]}>
              <input
                name="heightFt"
                type="number"
                min={3}
                max={8}
                defaultValue={player.heightFt ?? ""}
                className={inputCx}
              />
            </Field>
            <Field label="Height — in" hint="0–11.5, step 0.5" error={fieldErrors.heightIn?.[0]}>
              <input
                name="heightIn"
                type="number"
                min={0}
                max={11.5}
                step={0.5}
                defaultValue={player.heightIn ?? ""}
                className={inputCx}
              />
            </Field>
            <Field label="Weight — lbs" error={fieldErrors.weight?.[0]}>
              <input
                name="weight"
                type="number"
                min={50}
                max={500}
                defaultValue={player.weight ?? ""}
                className={inputCx}
              />
            </Field>
          </div>
        </Section>

        <Section title="Basketball">
          <Row>
            <Field label="Position" error={fieldErrors.position?.[0]}>
              <select
                name="position"
                defaultValue={player.position ?? ""}
                className={selectCx}
              >
                {POSITIONS.map((p) => (
                  <option key={p || "_"} value={p}>
                    {p || "—"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Grade" error={fieldErrors.level?.[0]}>
              <select
                name="level"
                defaultValue={player.level ?? "Not Rated"}
                className={selectCx}
              >
                {GRADES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="College" error={fieldErrors.college?.[0]}>
              <input name="college" defaultValue={player.college ?? ""} className={inputCx} />
            </Field>
            <Field label="Highest Level Played" error={fieldErrors.highestLevel?.[0]}>
              <select
                name="highestLevel"
                defaultValue={player.highestLevel ?? ""}
                className={selectCx}
              >
                {HIGHEST_LEVELS.map((l) => (
                  <option key={l || "_"} value={l}>
                    {l || "—"}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <Field
            label="Sport"
            hint="Sport played at the highest level"
            error={fieldErrors.sport?.[0]}
          >
            <input
              name="sport"
              defaultValue={player.sport ?? ""}
              className={inputCx}
              placeholder="Basketball"
            />
          </Field>
          <Field label="Status" error={fieldErrors.status?.[0]}>
            <select
              name="status"
              defaultValue={player.status}
              className={selectCx}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Whoop Privacy">
          <PrivacyNote>
            Your Whoop strain, heart rate, and calories are private by
            default — only you see them on your profile. Turn this on
            to share with your league&apos;s commissioners and let your
            data appear in head-to-head and leaderboard products.
          </PrivacyNote>
          <ToggleRow
            name="whoopShareWithLeague"
            defaultChecked={player.whoopShareWithLeague}
            label="Share Whoop data with my league"
            description="Includes strain, HR, and calories per game. You can turn this off any time."
          />
        </Section>

        {error && (
          <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
            {error}
          </div>
        )}

        <footer className="flex items-center justify-between gap-2 pt-4 border-t border-[color:var(--hairline)] -mx-6 px-6 max-sm:-mx-4 max-sm:px-4 max-sm:flex-col-reverse max-sm:items-stretch">
          <button
            type="button"
            onClick={() => setConfirmHide(true)}
            className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[color:var(--surface-2)] ${
              isHidden
                ? "text-[color:var(--up)]"
                : "text-[color:var(--text-2)]"
            }`}
          >
            {isHidden ? (
              <>
                <Eye size={14} /> Unhide player
              </>
            ) : (
              <>
                <EyeOff size={14} /> Hide player
              </>
            )}
          </button>
          <div className="flex items-center gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
            <button
              type="button"
              onClick={() => router.push(`/players/${player.id}`)}
              className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </form>

      {confirmHide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isHidden ? "Unhide player" : "Hide player"}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4 bg-black/60 backdrop-blur-[2px]"
          onClick={() => setConfirmHide(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[18px] font-bold mb-2">
              {isHidden ? "Unhide" : "Hide"} {player.firstName} {player.lastName}?
            </h3>
            <p className="text-[13px] text-[color:var(--text-3)]">
              {isHidden
                ? "The player will reappear on the roster and in pickers. Their game history was never lost — only the listing was hidden."
                : "Hiding removes the player from the roster and league pickers, but their game history, scores, and roster assignments stay intact. You can unhide any time."}
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmHide(false)}
                className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={hiding}
                onClick={onToggleHidden}
                className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
              >
                {hiding ? "Saving…" : isHidden ? "Unhide" : "Hide player"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
        {title}
      </div>
      {children}
    </div>
  );
}

const inputCx =
  "w-full h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] transition-colors placeholder:text-[color:var(--text-4)]";
const selectCx = inputCx + " pr-8 cursor-pointer";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="flex items-center justify-between text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        <span>{label}</span>
        {hint && (
          <span className="text-[color:var(--text-4)] tracking-normal lowercase font-medium normal-case">
            {hint}
          </span>
        )}
      </span>
      {children}
      {error && <span className="text-[11px] text-[color:var(--down)]">{error}</span>}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{children}</div>;
}

function PrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[color:var(--hairline)] bg-[color:var(--brand-soft)]/40 px-3 py-2.5 text-[12px] text-[color:var(--text-2)] leading-relaxed">
      {children}
    </div>
  );
}

function ToggleRow({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  description?: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`mt-0.5 inline-flex w-9 h-5 shrink-0 rounded-full relative transition-colors border ${
          checked
            ? "bg-[color:var(--brand)] border-[color:var(--brand)]"
            : "bg-[color:var(--surface-2)] border-[color:var(--hairline-2)]"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-[color:var(--text)]">
          {label}
        </span>
        {description && (
          <span className="text-[11.5px] text-[color:var(--text-3)] leading-snug">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
