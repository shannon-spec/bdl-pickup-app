"use client";

import { useState, useTransition } from "react";
import type { Team } from "@/lib/db";
import { createTeam, updateTeam } from "@/lib/actions/teams";
import { AVATAR_COLORS, LeagueAvatar } from "@/components/bdl/league-avatar";

const EMOJI_PRESETS = [
  "🏀", "🔥", "⭐️", "🏆", "💪", "🚀", "⚡️", "🎯",
  "🐺", "🦅", "🐯", "🦁", "🐍", "🦊", "🦈", "🐉",
];

const FORMATS = [
  { v: "5v5", l: "5 V 5" },
  { v: "3v3", l: "3 V 3" },
];

/** Shared team create/edit form. Mirrors LeagueForm, trimmed to the
 *  travel-team fields (avatar, name, city/state, default format, bio). */
export function TeamForm({
  editing,
  onCancel,
  onSaved,
  saveLabel,
}: {
  editing: Team | null;
  onCancel: () => void;
  onSaved: (id: string) => void;
  saveLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const [name, setName] = useState<string>(editing?.name ?? "");
  const [avatarKind, setAvatarKind] = useState<"monogram" | "emoji">(
    (editing?.avatarKind as "monogram" | "emoji") ?? "monogram",
  );
  const [avatarColor, setAvatarColor] = useState<string>(
    editing?.avatarColor ?? "brand",
  );
  const [avatarEmoji, setAvatarEmoji] = useState<string>(
    editing?.avatarEmoji ?? "",
  );
  const defaultFormat =
    editing?.defaultFormat === "3v3" ? "3v3" : "5v5";

  const abbr = (name.trim()[0] ?? "?").toUpperCase();

  const onSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = editing
        ? await updateTeam(editing.id, formData)
        : await createTeam(formData);
      if (res.ok) {
        onSaved(res.data?.id ?? editing?.id ?? "");
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  };

  return (
    <form action={onSubmit} className="flex flex-col gap-3.5">
      <input type="hidden" name="avatarKind" value={avatarKind} />
      <input type="hidden" name="avatarColor" value={avatarColor} />
      <input type="hidden" name="avatarEmoji" value={avatarEmoji} />
      <div className="flex flex-col gap-3 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] p-4 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
        <div className="flex items-center gap-4">
          <LeagueAvatar
            kind={avatarKind}
            color={avatarColor}
            emoji={avatarEmoji}
            abbr={abbr}
            size={64}
          />
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
              Avatar
            </span>
            <div className="inline-flex p-0.5 rounded-full bg-[color:var(--surface)] self-start shadow-[inset_0_0_0_1px_var(--hairline-2)]">
              <KindToggle
                active={avatarKind === "monogram"}
                onClick={() => setAvatarKind("monogram")}
              >
                Monogram
              </KindToggle>
              <KindToggle
                active={avatarKind === "emoji"}
                onClick={() => setAvatarKind("emoji")}
              >
                Emoji
              </KindToggle>
            </div>
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)] mb-1.5 block">
            Color
          </span>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={c.label}
                title={c.label}
                onClick={() => setAvatarColor(c.key)}
                className={`relative w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  avatarColor === c.key
                    ? "ring-2 ring-offset-2 ring-offset-[color:var(--surface-2)] ring-[color:var(--text)]"
                    : ""
                }`}
                style={{ background: c.background }}
              />
            ))}
          </div>
        </div>
        {avatarKind === "emoji" && (
          <div>
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)] mb-1.5 block">
              Emoji
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={avatarEmoji}
                onChange={(e) => setAvatarEmoji(e.target.value.slice(0, 4))}
                placeholder="🏀"
                aria-label="Custom emoji"
                className="w-14 h-9 rounded-[var(--r-md)] bg-[color:var(--surface)] text-center text-[18px] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)]"
              />
              <div className="flex flex-wrap gap-1">
                {EMOJI_PRESETS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setAvatarEmoji(e)}
                    className={`w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center text-[18px] hover:bg-[color:var(--surface)] transition-colors ${
                      avatarEmoji === e
                        ? "bg-[color:var(--surface)] ring-2 ring-[color:var(--brand)]"
                        : ""
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Field label="Team name *" error={fieldErrors.name?.[0]}>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className={inputCx}
          placeholder="Nashville Hoops"
        />
      </Field>
      <Row>
        <Field label="City">
          <input
            name="city"
            defaultValue={editing?.city ?? ""}
            className={inputCx}
            placeholder="Nashville"
          />
        </Field>
        <Field label="State" hint="2-letter" error={fieldErrors.state?.[0]}>
          <input
            name="state"
            defaultValue={editing?.state ?? ""}
            maxLength={2}
            className={inputCx}
            placeholder="TN"
          />
        </Field>
      </Row>
      <Field label="Default format" hint="per-game can override">
        <select
          name="defaultFormat"
          defaultValue={defaultFormat}
          className={selectCx}
        >
          {FORMATS.map((f) => (
            <option key={f.v} value={f.v}>
              {f.l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          defaultValue={editing?.description ?? ""}
          rows={3}
          className={inputCx + " py-2 h-auto resize-none"}
        />
      </Field>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 shadow-[inset_0_1px_0_0_var(--hairline)]">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : saveLabel ?? (editing ? "Save changes" : "Create team")}
        </button>
      </div>
    </form>
  );
}

const inputCx =
  "w-full h-10 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] transition-shadow placeholder:text-[color:var(--text-4)]";
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

function KindToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 h-7 rounded-full text-[11.5px] font-bold tracking-[0.04em] uppercase transition-colors ${
        active
          ? "bg-[color:var(--brand)] text-white"
          : "text-[color:var(--text-3)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}
