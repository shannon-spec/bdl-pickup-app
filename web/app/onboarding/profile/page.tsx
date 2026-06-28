import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { db, players } from "@/lib/db";
import { Brand } from "@/components/bdl/brand";
import { ProfileWizard, type ProfileValues } from "./profile-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Build your profile · BDL" };

export default async function OnboardingProfilePage() {
  const session = await readSession();
  if (!session?.playerId) redirect("/login?next=/onboarding/profile");

  const [me] = await db
    .select({
      firstName: players.firstName,
      lastName: players.lastName,
      city: players.city,
      state: players.state,
      zip: players.zip,
      college: players.college,
      sport: players.sport,
      position: players.position,
      heightFt: players.heightFt,
      heightIn: players.heightIn,
      weight: players.weight,
      highestLevel: players.highestLevel,
      level: players.level,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(eq(players.id, session.playerId))
    .limit(1);

  const initial: ProfileValues = {
    firstName: me?.firstName ?? "",
    lastName: me?.lastName ?? "",
    city: me?.city ?? "",
    state: me?.state ?? "",
    zip: me?.zip ?? "",
    college: me?.college ?? "",
    sport: me?.sport ?? "",
    position: me?.position ?? "",
    heightFt: me?.heightFt != null ? String(me.heightFt) : "",
    heightIn: me?.heightIn != null ? String(me.heightIn) : "",
    weight: me?.weight != null ? String(me.weight) : "",
    highestLevel: me?.highestLevel ?? "",
    level: (me?.level as ProfileValues["level"]) ?? "Not Rated",
  };

  return (
    <main className="min-h-[100dvh] flex justify-center bg-[color:var(--bg)] px-4 py-8">
      <div className="w-full max-w-[560px] flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Brand height={34} />
          <span className="text-[12px] font-semibold text-[color:var(--text-3)]">
            Phase 1 · Step 2 · Joining BDL
          </span>
        </div>
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.03em]">
            Build your community profile
          </h1>
          <p className="text-[13.5px] text-[color:var(--text-2)] mt-1">
            This joins the BDL community — not a specific league. Commissioners
            see it when you request to join.
          </p>
        </div>
        <ProfileWizard
          initial={initial}
          playerId={session.playerId}
          avatarUrl={me?.avatarUrl ?? null}
          initials={
            `${(me?.firstName ?? "")[0] ?? ""}${(me?.lastName ?? "")[0] ?? ""}`.toUpperCase() ||
            "•"
          }
        />
      </div>
    </main>
  );
}
