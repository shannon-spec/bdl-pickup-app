import Link from "next/link";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getActiveLeagueId } from "@/lib/cookies/active-league";
import {
  getLeagueMembers,
  getEligibleNonMembers,
  type MemberLite,
} from "@/lib/queries/league-members";
import { Pill } from "./pill";
import { MembersAdminControls } from "./members-admin-controls";

/**
 * League members strip. Top-of-page module mirroring CommissionerStrip.
 * - Members of the league (and admins/commissioners) see the list
 * - League managers (admin / commissioner of the league) see inline
 *   controls at the bottom for adding + removing members — but only
 *   in `manage` mode (hidden in player view).
 */
export async function MembersStrip({
  leagueId,
  mode = "manage",
}: {
  leagueId?: string;
  mode?: "player" | "manage";
}) {
  const session = await readSession();
  if (!session) return null;
  const id = leagueId ?? (await getActiveLeagueId());
  if (!id) return null;
  const members = await getLeagueMembers(id, session);
  if (!members) return null;
  const canManage = (await canManageLeague(session, id)) && mode === "manage";
  const eligible = canManage ? await getEligibleNonMembers(id) : [];

  if (members.length === 0 && !canManage) return null;

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
          Members
        </div>
        <span className="text-[11.5px] text-[color:var(--text-3)] num">
          {members.length}
        </span>
      </div>

      {members.length === 0 ? (
        <div className="text-[12.5px] text-[color:var(--text-3)] mb-3">
          No members yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <MemberPill key={m.id} m={m} />
          ))}
        </div>
      )}

      {canManage && (
        <MembersAdminControls
          leagueId={id}
          members={members.map((m) => ({
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
          }))}
          eligible={eligible}
        />
      )}
    </div>
  );
}

function MemberPill({ m }: { m: MemberLite }) {
  return (
    <Link
      href={`/players/${m.id}`}
      className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full bg-[color:var(--surface-2)] border border-[color:var(--hairline)] text-[11.5px] hover:bg-[color:var(--surface)] hover:border-[color:var(--text-4)] transition-colors"
    >
      <span className="font-bold text-[color:var(--text)] hover:text-[color:var(--brand)]">
        {m.firstName} {m.lastName}
      </span>
      {m.status !== "Active" && (
        <Pill tone={m.status === "IR" ? "loss" : "neutral"}>{m.status}</Pill>
      )}
    </Link>
  );
}
