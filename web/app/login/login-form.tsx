"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInAdmin } from "@/lib/auth/actions";
import {
  requestEmailOtp,
  verifyEmailOtp,
  requestOtp,
  verifyOtp,
} from "@/lib/auth/otp";
import { clearRememberedLogin } from "@/lib/cookies/last-login";

const input =
  "h-12 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[16px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]";
const primaryBtn =
  "mt-1 h-12 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const label =
  "text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]";

type Mode = "email" | "phone" | "password";

export function LoginForm({
  intent,
  next,
  remembered = null,
}: {
  intent: "play" | "coach" | "organize" | null;
  next: string | null;
  remembered?: { kind: "email" | "phone"; value: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(
    remembered?.kind === "phone" ? "phone" : "email",
  );

  const [step, setStep] = useState<"id" | "code">("id");
  const [identifier, setIdentifier] = useState(remembered?.value ?? "");
  const [greet, setGreet] = useState<boolean>(!!remembered);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isEmail = mode === "email";
  const req = isEmail ? requestEmailOtp : requestOtp;
  const ver = isEmail ? verifyEmailOtp : verifyOtp;
  const idLabel = isEmail ? "Email address" : "Phone number";
  const idPlaceholder = isEmail ? "you@example.com" : "(555) 123-4567";
  const sendLabel = isEmail ? "Email me a code" : "Text me a code";
  const idValid = isEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())
    : identifier.replace(/\D/g, "").length >= 10;

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("id");
    setIdentifier("");
    setCode("");
    setDevCode(null);
    setDelivered(true);
    setError(null);
    setGreet(false);
  };

  // "Not you?" — forget the remembered identifier on this device.
  const notYou = () => {
    setGreet(false);
    setIdentifier("");
    setMode("email");
    start(async () => {
      await clearRememberedLogin();
    });
  };

  const sendCode = () =>
    start(async () => {
      setError(null);
      const res = await req(identifier.trim());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDelivered(res.delivered);
      setDevCode(res.devCode ?? null);
      setStep("code");
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const res = await ver(identifier.trim(), code, {
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

  // ---------- PASSWORD MODE ----------
  if (mode === "password") {
    return (
      <form action={passwordSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Username or email</span>
          <input name="username" autoComplete="username" autoFocus required placeholder="username or you@example.com" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={label}>Password</span>
            <Link href="/forgot" className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--brand)] hover:underline">
              Forgot?
            </Link>
          </div>
          <input name="password" type="password" autoComplete="current-password" required className={input} />
        </label>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" onClick={() => switchMode("email")} className="text-[12px] text-center text-[color:var(--text-3)] hover:text-[color:var(--text)] mt-1">
          ← Use a sign-in code
        </button>
      </form>
    );
  }

  // ---------- EMAIL / PHONE CODE MODE ----------
  return (
    <div className="flex flex-col gap-3">
      {step === "id" ? (
        <>
          {greet && (
            <div className="flex items-center justify-between gap-2 rounded-[var(--r-md)] bg-[color:var(--brand-soft)] px-3 py-2">
              <span className="text-[13px] text-[color:var(--text-2)] min-w-0 truncate">
                👋 Welcome back,{" "}
                <strong className="text-[color:var(--text)]">{remembered?.value}</strong>
              </span>
              <button
                type="button"
                onClick={notYou}
                className="shrink-0 text-[12px] font-semibold text-[color:var(--brand)] hover:underline"
              >
                Not you?
              </button>
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className={label}>{idLabel}</span>
            <input
              type={isEmail ? "email" : "tel"}
              inputMode={isEmail ? "email" : "tel"}
              autoComplete={isEmail ? "email" : "tel"}
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={idPlaceholder}
              className={input}
              onKeyDown={(e) => e.key === "Enter" && idValid && sendCode()}
            />
          </label>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="button" onClick={sendCode} disabled={pending || !idValid} className={primaryBtn}>
            {pending ? "Sending…" : sendLabel}
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] text-[color:var(--text-2)] text-center">
            Enter the 6-digit code sent to{" "}
            <strong className="text-[color:var(--text)]">{identifier.trim()}</strong>.
          </p>
          {!delivered && (
            <div className="text-[12px] text-[color:var(--text-2)] bg-[color:var(--surface-2)] border border-[color:var(--hairline)] rounded-[var(--r-md)] px-3 py-2">
              {devCode ? (
                <>
                  Couldn&apos;t deliver — dev code: <strong>{devCode}</strong>
                </>
              ) : isEmail ? (
                <>Couldn&apos;t send the email. Try again or use password.</>
              ) : (
                <>
                  Texting isn&apos;t live yet — use{" "}
                  <button type="button" onClick={() => switchMode("email")} className="font-semibold text-[color:var(--brand)] underline">
                    email
                  </button>
                  .
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
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
            />
          </label>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="button" onClick={verify} disabled={pending || code.length < 6} className={primaryBtn}>
            {pending ? "Verifying…" : "Verify & continue"}
          </button>
          <div className="flex items-center justify-between text-[12px] mt-1">
            <button
              type="button"
              onClick={() => {
                setStep("id");
                setCode("");
                setError(null);
              }}
              className="text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            >
              ← Change {isEmail ? "email" : "number"}
            </button>
            <button type="button" onClick={sendCode} disabled={pending} className="font-semibold text-[color:var(--brand)] hover:underline disabled:opacity-60">
              Resend code
            </button>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 my-1">
        <span className="h-px flex-1 bg-[color:var(--hairline)]" />
        <span className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-4)]">or</span>
        <span className="h-px flex-1 bg-[color:var(--hairline)]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled className={socialBtn} title="Coming soon">
          Apple
        </button>
        <button type="button" disabled className={socialBtn} title="Coming soon">
          Google
        </button>
      </div>
      <button type="button" onClick={() => switchMode("password")} className="text-[12px] text-center text-[color:var(--text-3)] hover:text-[color:var(--text)] mt-1">
        Sign in with email &amp; password
      </button>
    </div>
  );
}

const socialBtn =
  "h-12 rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-semibold text-[color:var(--text-3)] flex items-center justify-center gap-2 cursor-not-allowed opacity-60";

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
      {children}
    </div>
  );
}
