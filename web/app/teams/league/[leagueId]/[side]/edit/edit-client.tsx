"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_COLORS, LeagueAvatar } from "@/components/bdl/league-avatar";
import { updateLeagueSideInfo } from "@/lib/actions/league-teams";

const EMOJI_PRESETS = [
  "🏀", "🔥", "⭐️", "🏆", "💪", "🚀", "⚡️", "🎯",
  "🐺", "🦅", "🐯", "🦁", "🐍", "🦊", "🦈", "🐉",
];

export function EditLeagueSideClient({
  leagueId,
  side,
  initial,
}: {
  leagueId: string;
  side: string;
  initial: {
    name: string;
    avatarKind: "monogram" | "emoji";
    avatarColor: string;
    avatarEmoji: string;
  };
}) {
  const router = useRouter();
  const back = `/teams/league/${leagueId}/${side}`;
  const [name, setName] = useState(initial.name);
  const [avatarKind, setAvatarKind] = useState(initial.avatarKind);
  const [avatarColor, setAvatarColor] = useState(initial.avatarColor);
  const [avatarEmoji, setAvatarEmoji] = useState(initial.avatarEmoji);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const abbr = (name.trim()[0] ?? "?").toUpperCase();

  const onSubmit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const res = await updateLeagueSideInfo(leagueId, side, formData);
      if (res.ok) {
        router.push(back);
        router.refresh();
      } else setError(res.error);
    });
  };

  const toggle =
    "h-7 px-3 rounded-full text-[12px] font-bold transition-colors";

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
              <button
                type="button"
                onClick={() => setAvatarKind("monogram")}
                className={`${toggle} ${avatarKind === "monogram" ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--text-3)]"}`}
              >
                Monogram
              </button>
              <button
                type="button"
                onClick={() => setAvatarKind("emoji")}
                className={`${toggle} ${avatarKind === "emoji" ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--text-3)]"}`}
              >
                Emoji
              </button>
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
                    className="w-9 h-9 rounded-[var(--r-md)] bg-[color:var(--surface)] text-[18px] hover:bg-[color:var(--brand-soft)] transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Team name
        </span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. White"
          className="h-10 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)]"
        />
        <span className="text-[11px] text-[color:var(--text-4)]">
          Leave blank to use the league&apos;s side name.
        </span>
      </label>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-[color:var(--hairline)]">
        <button
          type="button"
          onClick={() => router.push(back)}
          className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
