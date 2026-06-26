"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInAdmin } from "@/lib/auth/actions";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";

const input =
  "h-12 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[16px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]";
const primaryBtn =
  "mt-1 h-12 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const label =
  "text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]";

export function LoginForm({
  intent,
  next,
}: {
  intent: "play" | "organize" | null;
  next: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"otp" | "password">("otp");

  // OTP state
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [smsConfigured, setSmsConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sendCode = () =>
    start(async () => {
      setError(null);
      const res = await requestOtp(phone);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSmsConfigured(res.smsConfigured);
      setDevCode(res.devCode ?? null);
      setStep("code");
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const res = await verifyOtp(phone, code, {
        intent: intent ?? undefined,
        next: next ?? undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace(res.redirect);
      router.refresh();
    });

  const passwordSubmit = (formData: FormData) =>
    start(async () => {
      setError(null);
      const res = await signInAdmin(formData);
      if (res.ok) {
        router.replace(next?.startsWith("/") ? next : "/home");
        router.refresh();
      } else setError(res.error);
    });

  // ---------- OTP MODE ----------
  if (mode === "otp") {
    return (
      <div className="flex flex-col gap-3">
        {step === "phone" ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Phone number</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className={input}
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
              />
            </label>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button
              type="button"
              onClick={sendCode}
              disabled={pending || phone.replace(/\D/g, "").length < 10}
              className={primaryBtn}
            >
              {pending ? "Sending…" : "Text me a code"}
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-[color:var(--text-2)] text-center">
              Enter the 6-digit code sent to{" "}
              <strong className="text-[color:var(--text)]">{phone}</strong>.
            </p>
            {!smsConfigured && (
              <div className="text-[12px] text-[color:var(--text-2)] bg-[color:var(--surface-2)] border border-[color:var(--hairline)] rounded-[var(--r-md)] px-3 py-2">
                Texting isn&apos;t live yet.{" "}
                {devCode ? (
                  <>
                    Dev code: <strong>{devCode}</strong>
                  </>
                ) : (
                  <>
                    Use{" "}
                    <button
                      type="button"
                      onClick={() => setMode("password")}
                      className="font-semibold text-[color:var(--brand)] underline"
                    >
                      email sign-in
                    </button>{" "}
                    instead.
                  </>
                )}
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className={label}>Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className={`${input} tracking-[0.4em] text-center font-[family-name:var(--mono)]`}
                onKeyDown={(e) => e.key === "Enter" && verify()}
              />
            </label>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button
              type="button"
              onClick={verify}
              disabled={pending || code.length < 6}
              className={primaryBtn}
            >
              {pending ? "Verifying…" : "Verify & continue"}
            </button>
            <div className="flex items-center justify-between text-[12px] mt-1">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
                className="text-[color:var(--text-3)] hover:text-[color:var(--text)]"
              >
                ← Change number
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={pending}
                className="font-semibold text-[color:var(--brand)] hover:underline disabled:opacity-60"
              >
                Resend code
              </button>
            </div>
          </>
        )}

        <SocialAndAlt onEmail={() => setMode("password")} />
      </div>
    );
  }

  // ---------- PASSWORD MODE ----------
  return (
    <form action={passwordSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className={label}>Username or email</span>
        <input
          name="username"
          autoComplete="username"
          autoFocus
          required
          placeholder="username or you@example.com"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className={label}>Password</span>
          <Link
            href="/forgot"
            className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--brand)] hover:underline"
          >
            Forgot?
          </Link>
        </div>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </label>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode("otp");
          setError(null);
        }}
        className="text-[12px] text-center text-[color:var(--text-3)] hover:text-[color:var(--text)] mt-1"
      >
        ← Use phone instead
      </button>
    </form>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
      {children}
    </div>
  );
}

function SocialAndAlt({ onEmail }: { onEmail: () => void }) {
  const social =
    "h-12 rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-semibold text-[color:var(--text-3)] flex items-center justify-center gap-2 cursor-not-allowed opacity-60";
  return (
    <>
      <div className="flex items-center gap-3 my-1">
        <span className="h-px flex-1 bg-[color:var(--hairline)]" />
        <span className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-4)]">
          or
        </span>
        <span className="h-px flex-1 bg-[color:var(--hairline)]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled className={social} title="Coming soon">
          Apple
        </button>
        <button type="button" disabled className={social} title="Coming soon">
          Google
        </button>
      </div>
      <button
        type="button"
        onClick={onEmail}
        className="text-[12px] text-center text-[color:var(--text-3)] hover:text-[color:var(--text)] mt-1"
      >
        Sign in with email & password
      </button>
    </>
  );
}
