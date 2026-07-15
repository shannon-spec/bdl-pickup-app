import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { readSession } from "@/lib/auth/session";
import { getCart } from "@/lib/queries/training";
import { TrainingNav } from "../_components/training-nav";
import { LogClient } from "./log-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log Training · BDL" };

export default async function TrainingLogPage({
  searchParams,
}: {
  searchParams: Promise<{ ex?: string }>;
}) {
  const session = await readSession();
  if (!session?.playerId) redirect("/login?next=/training/log");

  const sp = await searchParams;
  const { cart } = await getCart(session.playerId);
  const initialSlug =
    cart.find((c) => c.slug === sp.ex)?.slug ?? cart[0]?.slug ?? null;

  return (
    <>
      <TopBar active="/training" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Training" right={<Pill tone="brand">beta</Pill>} />
        <TrainingNav active="log" />

        {cart.length === 0 ? (
          <div className="rounded-[16px] bg-[color:var(--surface)] p-8 text-center text-[13px] text-[color:var(--text-3)] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
            Add an exercise to your{" "}
            <Link href="/training/cart" className="font-semibold text-[color:var(--brand-ink)]">
              program
            </Link>{" "}
            before logging.
          </div>
        ) : (
          <LogClient cart={cart} initialSlug={initialSlug} />
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
