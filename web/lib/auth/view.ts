/**
 * Active view ("lens") resolution.
 *
 * The view is purely UI lensing. The real security boundary remains the
 * existing perm helpers (requireLeagueManager, requireAdminOnly, etc.).
 * Mutating server actions also call requireManageView() so a user who
 * has lowered themselves to "player" can't accidentally add or change
 * data — they have to switch lens first.
 */
import { readSession, type Session } from "./session";
import { getMyCommissionerLeagueIds, isAdminLike } from "./perms";
import { getActiveViewCookie, type View } from "@/lib/cookies/active-view";

export type { View };

export type ViewCapabilities = {
  view: View;
  isAdmin: boolean;
  isCommissioner: boolean;
  /** True for views that allow mutating/management UI. */
  canManage: boolean;
  /** Roles the toggle should expose for this user (always includes player). */
  options: View[];
};

/**
 * Resolve the active view with the perm ceiling enforced. A user with no
 * commissioner / admin rights always sees "player". Defaults to "player"
 * for first-time visitors so management UI is opt-in.
 */
export async function getViewCaps(
  session: Session | null,
): Promise<ViewCapabilities> {
  if (!session) {
    return {
      view: "player",
      isAdmin: false,
      isCommissioner: false,
      canManage: false,
      options: ["player"],
    };
  }
  const isAdmin = isAdminLike(session);
  const commishIds = await getMyCommissionerLeagueIds(session);
  const isCommissioner = commishIds.length > 0 || isAdmin;

  const options: View[] = ["player"];
  if (isCommissioner) options.push("commissioner");
  if (isAdmin) options.push("admin");

  const stored = await getActiveViewCookie();
  let view: View = "player";
  if (stored === "admin" && isAdmin) view = "admin";
  else if (stored === "commissioner" && isCommissioner) view = "commissioner";
  else if (stored === "player") view = "player";
  else view = "player"; // unset → opt-in default

  return {
    view,
    isAdmin,
    isCommissioner,
    canManage: view === "commissioner" || view === "admin",
    options,
  };
}

/**
 * Throws if the active view is not management-capable. Real perms are
 * still validated separately by requireLeagueManager / requireAdminOnly.
 */
export async function requireManageView(): Promise<void> {
  const session = await readSession();
  const caps = await getViewCaps(session);
  if (!caps.canManage) {
    throw new Error(
      "Switch to Commissioner or Admin view to perform this action.",
    );
  }
}

/** Throws unless current view is admin. */
export async function requireAdminView(): Promise<void> {
  const session = await readSession();
  const caps = await getViewCaps(session);
  if (caps.view !== "admin") {
    throw new Error("Switch to Admin view to perform this action.");
  }
}
