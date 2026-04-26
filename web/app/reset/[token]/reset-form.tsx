"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth/password-reset";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    formData.set("token", token);
    start(async () => {
      const res = await resetPassword(formData);
      if (res.ok) {
        setDone(true);
        // Pause on the success state so the user sees confirmation.
        setTimeout(() => router.replace("/login"), 1500);
      } else {
        setError(res.error);
      }
    });
  };

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-[13px] text-[color:var(--up)] bg-[color:var(--up-soft)] rounded-[var(--r-md)] px-3.5 py-3 text-center">
          Password updated. Redirecting to sign in…
        </div>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          New password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Confirm password
        </span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </label>
      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Updating…" : "Set new password"}
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
