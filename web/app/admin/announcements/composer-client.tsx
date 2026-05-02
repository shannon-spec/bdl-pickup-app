"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { createAnnouncement } from "@/lib/actions/announcements";

type Scope = "global" | "league";

export function ComposerClient({
  isAdmin,
  leagueOptions,
}: {
  isAdmin: boolean;
  leagueOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(isAdmin ? "global" : "league");
  const [leagueId, setLeagueId] = useState<string>(leagueOptions[0]?.id ?? "");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("scope", scope);
    if (scope === "league") fd.set("leagueId", leagueId);
    fd.set("headline", headline);
    fd.set("body", body);
    fd.set("ctaLabel", ctaLabel);
    fd.set("ctaUrl", ctaUrl);
    start(async () => {
      const res = await createAnnouncement(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(`Sent to ${res.data.recipientCount} player${res.data.recipientCount === 1 ? "" : "s"}.`);
      setHeadline("");
      setBody("");
      setCtaLabel("");
      setCtaUrl("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-5 flex flex-col gap-3.5">
      <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
        Compose
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Audience
        </span>
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setScope("global")}
              className={`h-10 rounded-[var(--r-md)] border text-[12px] font-bold tracking-[0.04em] uppercase transition-colors ${
                scope === "global"
                  ? "bg-[color:var(--brand-soft)] border-[color:var(--brand)] text-[color:var(--brand-ink,var(--brand))]"
                  : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
              }`}
            >
              🌐 Global · Every player
            </button>
          )}
          <button
            type="button"
            onClick={() => setScope("league")}
            className={`h-10 rounded-[var(--r-md)] border text-[12px] font-bold tracking-[0.04em] uppercase transition-colors ${
              scope === "league"
                ? "bg-[color:var(--brand-soft)] border-[color:var(--brand)] text-[color:var(--brand-ink,var(--brand))]"
                : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
            }`}
          >
            🏟️ League members
          </button>
        </div>
        {scope === "league" && (
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none mt-1.5"
          >
            {leagueOptions.length === 0 && (
              <option value="">No leagues available</option>
            )}
            {leagueOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Headline
        </span>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={160}
          placeholder="Short, scannable — what's this about?"
          className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Message
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Write your announcement…"
          className="rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:border-[color:var(--brand)] resize-y"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
            CTA Label <span className="text-[color:var(--text-4)] font-normal normal-case tracking-normal">(optional)</span>
          </span>
          <input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            maxLength={40}
            placeholder="View League"
            className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
            CTA URL <span className="text-[color:var(--text-4)] font-normal normal-case tracking-normal">(optional)</span>
          </span>
          <input
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            maxLength={500}
            placeholder="/leagues/abc123 or https://…"
            className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
          />
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="text-[12px] text-[color:var(--up)] bg-[color:var(--up-soft)] rounded-[var(--r-md)] px-3 py-2">
          {success}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={
            pending ||
            !headline.trim() ||
            !body.trim() ||
            (scope === "league" && !leagueId)
          }
          className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Send size={13} /> {pending ? "Sending…" : "Send announcement"}
        </button>
      </div>
    </div>
  );
}
