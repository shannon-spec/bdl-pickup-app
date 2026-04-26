"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/password-reset";

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    start(async () => {
      await requestPasswordReset(formData);
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-[13px] text-[color:var(--text-2)] bg-[color:var(--surface-2)] border border-[color:var(--hairline)] rounded-[var(--r-md)] px-3.5 py-3">
          If that email is registered, a reset link is on its way. The link
          expires in 30 minutes.
        </div>
        <Link
          href="/login"
          className="text-center text-[13px] font-semibold text-[color:var(--brand)] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Email address
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <Link
        href="/login"
        className="text-center text-[12.5px] text-[color:var(--text-3)] hover:text-[color:var(--text)] mt-1"
      >
        Back to sign in
      </Link>
    </form>
  );
}
