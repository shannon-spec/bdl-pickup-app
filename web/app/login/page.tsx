import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { Brand } from "@/components/bdl/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · BDL" };

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/");

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-8">
        <div className="flex flex-col items-center gap-4 mb-7">
          <Brand height={56} />
          <div className="text-center">
            <h1 className="text-[18px] font-bold tracking-[-0.02em]">Sign in</h1>
            <p className="text-[13px] text-[color:var(--text-3)] mt-1">
              Ball Don&apos;t Lie Pickup Tracker
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
