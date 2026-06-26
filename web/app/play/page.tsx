import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { ComingSoon } from "@/components/bdl/coming-soon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Play · BDL" };

export default async function PlayPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/play");
  return (
    <ComingSoon
      active="/play"
      title="Play"
      blurb="Find runs near you, RSVP, and track your stats. This surface is coming soon — your season dashboard lives on Home for now."
    />
  );
}
