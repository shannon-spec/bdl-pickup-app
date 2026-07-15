import { redirect } from "next/navigation";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { readSession } from "@/lib/auth/session";
import { getCart } from "@/lib/queries/training";
import { TrainingNav } from "../_components/training-nav";
import { CartClient } from "./cart-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training Cart · BDL" };

export default async function TrainingCartPage() {
  const session = await readSession();
  if (!session?.playerId) redirect("/login?next=/training/cart");

  const { cart, addable } = await getCart(session.playerId);

  return (
    <>
      <TopBar active="/training" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Training" right={<Pill tone="brand">beta</Pill>} />
        <TrainingNav active="cart" />
        <CartClient cart={cart} addable={addable} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
