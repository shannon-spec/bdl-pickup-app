import { BrandMark } from "@/components/bdl/brand";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password · BDL" };

export default function ForgotPage() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-8">
        <div className="flex flex-col items-center gap-3 mb-7">
          <BrandMark size={44} />
          <div className="text-center">
            <h1 className="text-[18px] font-bold tracking-[-0.02em]">
              Reset your password
            </h1>
            <p className="text-[13px] text-[color:var(--text-3)] mt-1">
              We&apos;ll email you a link to set a new one.
            </p>
          </div>
        </div>
        <ForgotForm />
      </div>
    </main>
  );
}
