import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { ComingSoon } from "@/components/bdl/coming-soon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage community · BDL" };

export default async function ManageCommunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/manage/community/${id}`);
  return (
    <ComingSoon
      active="/manage"
      title="Community management"
      blurb="Manage the leagues and tournaments this community owns, plus members and organizers. Console tabs are coming soon."
    />
  );
}
