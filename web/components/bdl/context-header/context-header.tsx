import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { getSessionContext } from "@/lib/queries/session-context";
import { getMyTeamsForSwitcher } from "@/lib/queries/teams";
import { ContextHeaderClient } from "./context-header-client";

/**
 * Server-rendered wrapper that loads the current session context and
 * hands it to the client subcomponents (LeagueSwitcher + RoleToggle).
 *
 * Renders nothing if there's no session (e.g. on /login or /invite/*),
 * so it's safe to drop into a layout. Messaging access lives in the
 * top-bar bell, so the header no longer carries a Message button.
 */
export async function ContextHeader() {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const session = await readSession();
  const caps = await getViewCaps(session);
  const teams = await getMyTeamsForSwitcher(session);
  return (
    <ContextHeaderClient
      ctx={ctx}
      view={caps.view}
      options={caps.options}
      canManage={caps.canManage}
      teams={teams}
    />
  );
}
