"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  castPlayerGrade,
  clearPlayerGrade,
} from "@/lib/actions/player-grades";
import type {
  GradeKey,
  PlayerGradeAggregate,
} from "@/lib/queries/player-grades";
import { GRADE_PALETTE, GradePill } from "@/components/bdl/grade-pill-color";

const VOTABLE: GradeKey[] = [
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
];

export function GradePanel({
  targetId,
  agg,
}: {
  targetId: string;
  agg: PlayerGradeAggregate;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<GradeKey | "">(agg.myVote ?? "");

  const onSubmit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const res = await castPlayerGrade(formData);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  const onClear = () => {
    setError(null);
    start(async () => {
      const res = await clearPlayerGrade(targetId);
      if (res.ok) {
        setPick("");
        router.refresh();
      } else setError(res.error);
    });
  };

  const totalVotes = agg.peerCount + agg.commissionerCount;

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6">
      <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)] flex items-center gap-2 mb-5">
        <span aria-hidden className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]" />
        BDL Grade
      </div>

      <div className="flex items-center gap-5 flex-wrap mb-2 max-sm:gap-3">
        {agg.crowdGrade ? (
          <GradePill grade={agg.crowdGrade} size="lg" />
        ) : (
          <span className="inline-flex items-center px-5 py-2 rounded-full font-extrabold text-[22px] tracking-[-0.01em] bg-[color:var(--surface-2)] text-[color:var(--text-3)]">
            Not yet rated
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] text-[color:var(--text-2)] font-semibold">
            {totalVotes === 0
              ? "No votes yet"
              : `${agg.peerCount} player ${agg.peerCount === 1 ? "vote" : "votes"} · ${agg.commissionerCount} commissioner ${agg.commissionerCount === 1 ? "vote" : "votes"}`}
          </span>
          <Link
            href="/grades?context=player"
            className="text-[11.5px] text-[color:var(--text-3)] hover:text-[color:var(--brand)] underline-offset-4 hover:underline"
          >
            What do these mean?
          </Link>
        </div>
      </div>

      {agg.canVote ? (
        <form action={onSubmit} className="mt-5">
          <input type="hidden" name="targetId" value={targetId} />
          <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] mb-2">
            Your grade
          </div>
          <div className="flex flex-wrap gap-2">
            {VOTABLE.map((g) => {
              const active = pick === g;
              const p = GRADE_PALETTE[g];
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setPick(g)}
                  className="h-7 px-2.5 rounded-full text-[10px] font-bold tracking-[0.04em] transition-colors"
                  style={
                    active
                      ? {
                          background: p.text,
                          color: "white",
                          boxShadow: `inset 0 0 0 1px ${p.text}`,
                        }
                      : {
                          background: p.bg,
                          color: p.text,
                          boxShadow: `inset 0 0 0 1px ${p.ring}`,
                        }
                  }
                  aria-pressed={active}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="grade" value={pick} />

          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={pending || pick === "" || pick === agg.myVote}
              className="h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending
                ? "Saving…"
                : agg.myVote
                  ? "Update grade"
                  : "Submit grade"}
            </button>
            {agg.myVote && (
              <button
                type="button"
                onClick={onClear}
                disabled={pending}
                className="h-10 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] text-[12px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-3)] transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
          {error && (
            <div className="mt-3 text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
              {error}
            </div>
          )}
        </form>
      ) : null}

      <p className="text-[11px] text-[color:var(--text-4)] mt-5 italic">
        All player-grade voting is anonymous — individual votes are
        never shown.
      </p>
    </div>
  );
}
