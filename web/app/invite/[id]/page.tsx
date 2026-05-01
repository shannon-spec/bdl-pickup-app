import { notFound } from "next/navigation";
import { BrandMark } from "@/components/bdl/brand";
import { getInvite } from "@/lib/queries/invites";
import { AcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "You're invited · BDL" };

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ accepted?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const invite = await getInvite(id);
  if (!invite) notFound();

  // Just-accepted state — set on the redirect after a successful
  // acceptInvite action. Refresh-safe: this view stays put as long
  // as the user keeps the ?accepted=1 query param. Differentiates
  // from a cold revisit by a person who isn't the original invitee.
  if (invite.status === "accepted" && sp.accepted === "1") {
    return (
      <Frame>
        <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--up)] mb-1">
          You&apos;re in
        </div>
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">
          Welcome to {invite.leagueName ?? "the league"}
        </h1>
        <p className="text-[14px] text-[color:var(--text-3)] mt-2">
          Hi {invite.firstName}, your spot in{" "}
          <strong className="text-[color:var(--text-2)]">{invite.leagueName}</strong> is
          locked in. Look out for invites to upcoming games from your commissioner.
        </p>
      </Frame>
    );
  }

  // Cold revisit of an accepted invite (refresh after losing the
  // ?accepted=1 param, or someone else clicking a stale link).
  // Friendly + informational, not error-tone.
  if (invite.status === "accepted") {
    return (
      <Frame>
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em] mb-2">
          This invite has been accepted
        </h1>
        <p className="text-[14px] text-[color:var(--text-3)]">
          {invite.firstName} is already in
          {invite.leagueName ? (
            <>
              {" "}
              <strong className="text-[color:var(--text-2)]">
                {invite.leagueName}
              </strong>
            </>
          ) : (
            " the league"
          )}
          . If you&apos;re trying to reach a different player or league, ask the
          commissioner for a fresh invite link.
        </p>
      </Frame>
    );
  }
  if (invite.status === "expired") {
    return (
      <Frame>
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em] mb-2">Invite expired</h1>
        <p className="text-[14px] text-[color:var(--text-3)]">
          Ask the league to send a new one.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mb-1">
        You&apos;re invited
      </div>
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">
        Join {invite.leagueName ?? "the league"}
      </h1>
      <p className="text-[14px] text-[color:var(--text-3)] mt-2">
        Hi {invite.firstName}, the commissioner has added you to{" "}
        <strong className="text-[color:var(--text-2)]">{invite.leagueName}</strong>. Confirm
        a few details and you&apos;re in.
      </p>
      <div className="mt-5 rounded-[var(--r-md)] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] text-[color:var(--text-2)]">
        <div>
          <span className="text-[color:var(--text-3)]">Name</span> · {invite.firstName}{" "}
          {invite.lastName}
        </div>
        <div>
          <span className="text-[color:var(--text-3)]">Email</span> · {invite.email}
        </div>
      </div>
      <div className="mt-5">
        <AcceptForm inviteId={invite.id} />
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-7">
        <div className="flex justify-center mb-4">
          <BrandMark size={42} />
        </div>
        {children}
      </div>
    </main>
  );
}
