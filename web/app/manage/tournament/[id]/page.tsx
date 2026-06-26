import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { ComingSoon } from "@/components/bdl/coming-soon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage tournament · BDL" };

export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/manage/tournament/${id}`);
  return (
    <ComingSoon
      active="/manage"
      title="Tournament management"
      blurb="Brackets, entries, and seeding are coming soon for this tournament."
    />
  );
}
