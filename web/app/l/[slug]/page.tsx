import { redirect } from "next/navigation";

// Public short-link → existing league page (slug accepts the league id).
export default async function LeagueShortLink({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/leagues/${slug}`);
}
