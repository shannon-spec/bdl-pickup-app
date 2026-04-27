import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { getInviteByToken } from "@/lib/queries/game-invites";
import { ClaimForm } from "./claim-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite · BDL" };

const fmtDate = (date: string | null, time: string | null) => {
  if (!date) return "—";
  const dt = new Date(date + "T00:00:00");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()];
  let out = `${wd} · ${mo} ${dt.getDate()}`;
  if (time) {
    const [h, m] = time.split(":");
    const hr = Number(h);
    out += ` · ${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  }
  return out;
};

export default async function InviteClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await getInviteByToken(token);
  if (!row) notFound();

  const { invite, game, league, player } = row;
  const expiresMs = invite.expiresAt ? invite.expiresAt.getTime() - Date.now() : 0;
  const isPending = invite.state === "pending" && expiresMs > 0;
  const headline =
    invite.state === "confirmed"
      ? "You're confirmed."
      : invite.state === "declined"
        ? "You declined this invite."
        : invite.state === "expired" || (invite.state === "pending" && expiresMs <= 0)
          ? "This invite has expired."
          : invite.state === "cancelled"
            ? "This invite was cancelled."
            : invite.state === "superseded"
              ? "This invite was replaced by a newer one."
              : "You're invited.";

  return (
    <>
      <TopBar />
      <PageFrame>
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 py-7 max-sm:px-5 max-w-[560px] mx-auto w-full">
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mb-1">
            {league?.name ?? game.leagueName ?? "BDL game"}
          </div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] mb-4">
            {headline}
          </h1>

          <div className="rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-5 py-4 mb-6">
            <div className="text-[15px] font-bold">
              {fmtDate(game.gameDate, game.gameTime)}
            </div>
            {game.venue && (
              <div className="text-[13px] text-[color:var(--text-3)] mt-0.5">
                {game.venue}
              </div>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              <Pill tone="neutral">{game.format}</Pill>
              {invite.state === "pending" && expiresMs > 0 && (
                <Pill tone="warn">
                  Expires{" "}
                  {Math.round(expiresMs / 60000) < 60
                    ? `in ${Math.round(expiresMs / 60000)} min`
                    : `in ${Math.round(expiresMs / 3_600_000)} h`}
                </Pill>
              )}
              {invite.state === "confirmed" && (
                <Pill tone="win">Confirmed · {invite.assignedTeam === "A" ? game.teamAName ?? "White" : invite.assignedTeam === "B" ? game.teamBName ?? "Dark" : "Team TBD"}</Pill>
              )}
            </div>
          </div>

          <p className="text-[14px] text-[color:var(--text-2)] mb-5">
            Hi <strong className="text-[color:var(--text)]">{player.firstName}</strong> — {isPending ? "claim a seat or pass below." : "this invite isn't active anymore."}
          </p>

          {isPending ? (
            <ClaimForm token={token} />
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="h-10 px-4 inline-flex items-center rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold tracking-[0.06em] uppercase hover:bg-[color:var(--surface-2)]"
              >
                Open BDL
              </Link>
            </div>
          )}
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
