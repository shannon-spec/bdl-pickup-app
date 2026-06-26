import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { Brand } from "@/components/bdl/brand";
import { ApplyPersona } from "./apply-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome · BDL" };

const VALID = new Set(["play", "coach", "organize", "watch"]);

export default async function WelcomePersonaPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const session = await readSession();
  const { persona } = await params;
  if (!session) redirect(`/login?next=/welcome/${persona}`);
  if (!VALID.has(persona)) redirect("/welcome");

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[360px] flex flex-col items-center gap-4 text-center">
        <Brand height={44} />
        <ApplyPersona persona={persona} />
      </div>
    </main>
  );
}
