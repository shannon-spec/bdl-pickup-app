"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAdmin } from "@/lib/auth/actions";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const result = await signInAdmin(formData);
      if (result.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Username
        </span>
        <input
          name="username"
          autoComplete="username"
          autoFocus
          required
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
