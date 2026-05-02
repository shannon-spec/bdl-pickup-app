import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox · BDL" };

// /inbox merged into the unified Message Center at /messages.
export default function InboxRedirect() {
  redirect("/messages");
}
