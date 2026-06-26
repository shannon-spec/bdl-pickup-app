import { redirect } from "next/navigation";

// Public short-link → existing team page.
export default async function TeamShortLink({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/teams/${slug}`);
}
