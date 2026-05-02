import { redirect } from "next/navigation";

// Announcements are now part of the unified Message Center.
// Permanent redirect — preserves any in-the-wild bookmarks.
export default function AnnouncementsRedirect() {
  redirect("/messages");
}
