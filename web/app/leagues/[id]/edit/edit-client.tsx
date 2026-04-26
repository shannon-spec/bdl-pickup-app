"use client";

import { useRouter } from "next/navigation";
import type { League } from "@/lib/db";
import { LeagueForm } from "../../league-form";

export function EditLeagueClient({ league }: { league: League }) {
  const router = useRouter();
  const back = `/leagues/${league.id}`;
  return (
    <LeagueForm
      editing={league}
      onCancel={() => router.push(back)}
      onSaved={() => {
        router.push(back);
        router.refresh();
      }}
      saveLabel="Save changes"
    />
  );
}
