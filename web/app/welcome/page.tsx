import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { Brand } from "@/components/bdl/brand";
import { WelcomeClient } from "./welcome-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome · BDL" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; persona?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login?next=/welcome");
  const sp = await searchParams;
  const preselect =
    sp.persona ??
    (sp.intent === "organize" ? "organize" : sp.intent === "play" ? "play" : null);

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          <Brand height={44} />
          <div>
            <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">
              What brings you here?
            </h1>
            <p className="text-[13px] text-[color:var(--text-3)] mt-1">
              Pick a starting point. This just sets your home.
            </p>
          </div>
        </div>
        <WelcomeClient preselect={preselect} />
      </div>
    </main>
  );
}
