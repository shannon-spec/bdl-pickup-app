import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { ComingSoon } from "@/components/bdl/coming-soon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage · BDL" };

export default async function ManagePage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/manage");
  return (
    <ComingSoon
      active="/manage"
      title="Manage console"
      blurb="Run your leagues, tournaments, and communities from one place. The full console is on the way — create a league or team from the buttons in your header for now."
    />
  );
}
