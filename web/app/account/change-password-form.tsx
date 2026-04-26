"use client";

import { useRef, useState, useTransition } from "react";
import { changePassword } from "@/lib/auth/password-reset";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    setSuccess(false);
    start(async () => {
      const res = await changePassword(formData);
      if (res.ok) {
        setSuccess(true);
        formRef.current?.reset();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="flex flex-col gap-3 max-w-[420px]"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Current password
        </span>
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          New password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          Confirm new password
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
      {success && (
        <div className="text-[12px] text-[color:var(--up)] bg-[color:var(--up-soft)] rounded-[var(--r-md)] px-3 py-2">
          Password updated.
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-11 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
