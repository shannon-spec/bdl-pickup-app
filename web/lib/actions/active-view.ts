"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth/session";
import { getMyCommissionerLeagueIds, isAdminLike } from "@/lib/auth/perms";
import { writeActiveViewCookie, type View } from "@/lib/cookies/active-view";

/**
 * Switch the active view. The cookie is the source of truth, but we
 * enforce the perm ceiling here too — a non-admin who tries to flip
 * to "admin" gets pushed back to whatever they're actually allowed.
 */
export async function setActiveViewAction(view: View): Promise<void> {
  const session = await readSession();
  if (!session) return;
  const isAdmin = isAdminLike(session);
  const commishIds = await getMyCommissionerLeagueIds(session);
  const isCommissioner = commishIds.length > 0 || isAdmin;

  let safe: View = "player";
  if (view === "admin" && isAdmin) safe = "admin";
  else if (view === "commissioner" && isCommissioner) safe = "commissioner";
  else safe = "player";

  await writeActiveViewCookie(safe);
  revalidatePath("/", "layout");
}
