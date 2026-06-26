"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[400px] text-center flex flex-col items-center gap-4">
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">
          Something went sideways
        </h1>
        <p className="text-[14px] text-[color:var(--text-2)]">
          That page hit a snag. Try again, or head home.
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center h-11 px-5 rounded-[12px] bg-[color:var(--brand)] text-white font-bold text-[13px] tracking-[0.04em] uppercase hover:bg-[color:var(--brand-hover)]"
          >
            Try again
          </button>
          <Link
            href="/home"
            className="inline-flex items-center h-11 px-5 rounded-[12px] bg-[color:var(--surface)] font-bold text-[13px] text-[color:var(--text-2)] hover:bg-[color:var(--surface-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
