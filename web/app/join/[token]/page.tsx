import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { getInvite } from "@/lib/actions/organizer-invites";
import { Brand } from "@/components/bdl/brand";
import { JoinClient } from "./join-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join · BDL" };

const TYPE_LABEL: Record<string, string> = {
  LEAGUE: "league",
  TOURNAMENT: "tournament",
  COMMUNITY: "community",
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await readSession();
  if (!session?.playerId) redirect(`/login?next=/join/${token}`);

  const invite = await getInvite(token);

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-10 bg-[color:var(--bg)]">
      <div className="w-full max-w-[400px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        <Brand height={40} />
        {invite?.valid ? (
          <>
            <div>
              <h1 className="text-[19px] font-extrabold tracking-[-0.02em]">
                Co-organizer invite
              </h1>
              <p className="text-[13.5px] text-[color:var(--text-2)] mt-1">
                You&apos;ve been invited to help run this{" "}
                {TYPE_LABEL[invite.contextType ?? ""] ?? "event"} as{" "}
                <strong className="text-[color:var(--text)]">
                  {(invite.role ?? "").toLowerCase()}
                </strong>
                .
              </p>
            </div>
            <JoinClient
              token={token}
              roleLabel={(invite.role ?? "organizer").toLowerCase()}
            />
          </>
        ) : (
          <>
            <h1 className="text-[18px] font-extrabold tracking-[-0.02em]">
              Invite unavailable
            </h1>
            <p className="text-[13.5px] text-[color:var(--text-2)]">
              {invite?.reason ?? "This invite link isn't valid."}
            </p>
            <Link
              href="/home"
              className="inline-flex items-center h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em]"
            >
              Go home
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
