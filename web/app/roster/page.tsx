import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /roster used to be the admin-only player directory. /players now
 * carries that responsibility for every view (with admin-only Add
 * Player + search), so /roster just forwards. Keeps any old links,
 * bookmarks, or revalidatePath("/roster") calls from 404'ing.
 */
export default function RosterRedirect() {
  redirect("/players");
}
