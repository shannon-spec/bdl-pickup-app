import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { ComingSoon } from "@/components/bdl/coming-soon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage league · BDL" };

export default async function ManageLeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/manage/league/${id}`);
  return (
    <ComingSoon
      active="/manage"
      title="League management"
      blurb="Scheduling, divisions, and member tools for this league are coming soon. Manage the league itself from its page for now."
    />
  );
}
