import { redirect } from "next/navigation";

// Public short-link → existing player page.
export default async function PlayerShortLink({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/players/${id}`);
}
