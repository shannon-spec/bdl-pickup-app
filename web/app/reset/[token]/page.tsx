import Link from "next/link";
import { BrandMark } from "@/components/bdl/brand";
import { getResetTokenStatus } from "@/lib/auth/password-reset";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password · BDL" };

export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const status = await getResetTokenStatus(token);

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-8">
        <div className="flex flex-col items-center gap-3 mb-7">
          <BrandMark size={44} />
          <div className="text-center">
            <h1 className="text-[18px] font-bold tracking-[-0.02em]">
              {status === "valid" ? "Set a new password" : "Reset link"}
            </h1>
            <p className="text-[13px] text-[color:var(--text-3)] mt-1">
              {status === "valid"
                ? "Pick a password you'll remember."
                : status === "used"
                  ? "This link has already been used."
                  : status === "expired"
                    ? "This link has expired."
                    : "This link is invalid."}
            </p>
          </div>
        </div>
        {status === "valid" ? (
          <ResetForm token={token} />
        ) : (
          <div className="flex flex-col gap-3">
            <Link
              href="/forgot"
              className="h-11 inline-flex items-center justify-center rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] transition-colors"
            >
              Request a new link
            </Link>
            <Link
              href="/login"
              className="text-center text-[12.5px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
