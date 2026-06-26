import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { getSessionContext } from "@/lib/queries/session-context";
import { getMyTeamsForSwitcher } from "@/lib/queries/teams";
import { getMyContexts } from "@/lib/queries/contexts";
import { ContextHeaderClient } from "./context-header-client";
import type { SwitcherTeam } from "./league-switcher";

/**
 * Server-rendered wrapper that loads the current session context and
 * hands it to the client subcomponents (LeagueSwitcher + RoleToggle).
 *
 * Renders nothing if there's no session (e.g. on /login or /invite/*),
 * so it's safe to drop into a layout. Messaging access lives in the
 * top-bar bell, so the header no longer carries a Message button.
 */
export async function ContextHeader({
  activeTeam = null,
}: {
  /** When on a team page, the team to surface as the active context. */
  activeTeam?: SwitcherTeam | null;
} = {}) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const session = await readSession();
  const caps = await getViewCaps(session);
  const [teams, allContexts] = await Promise.all([
    getMyTeamsForSwitcher(session),
    getMyContexts(session),
  ]);
  const toSwitcher = (type: "TOURNAMENT" | "COMMUNITY"): SwitcherTeam[] =>
    allContexts
      .filter((c) => c.type === type)
      .map((c) => ({
        id: c.id,
        name: c.name,
        avatarKind: c.avatarKind,
        avatarColor: c.avatarColor,
        avatarEmoji: c.avatarEmoji,
        href: c.href,
      }));
  return (
    <ContextHeaderClient
      ctx={ctx}
      view={caps.view}
      options={caps.options}
      canManage={caps.canManage}
      teams={teams}
      tournaments={toSwitcher("TOURNAMENT")}
      communities={toSwitcher("COMMUNITY")}
      activeTeam={activeTeam}
    />
  );
}
