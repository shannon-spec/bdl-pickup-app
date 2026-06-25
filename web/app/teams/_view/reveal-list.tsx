"use client";

import { useState } from "react";

/**
 * Renders the first `initial` items and a "Show more results" button that
 * reveals `step` more each click. Items are pre-rendered nodes.
 */
export function RevealList({
  items,
  initial = 25,
  step = 25,
  className,
}: {
  items: React.ReactNode[];
  initial?: number;
  step?: number;
  className?: string;
}) {
  const [count, setCount] = useState(initial);
  const remaining = items.length - count;

  return (
    <>
      <div className={className}>{items.slice(0, count)}</div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setCount((c) => c + step)}
          className="mt-3 w-full h-10 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[12px] font-bold tracking-[0.04em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
        >
          Show {Math.min(step, remaining)} more {remaining === 1 ? "result" : "results"}
        </button>
      )}
    </>
  );
}
