"use client";

import { useRouter } from "next/navigation";
import { LeagueForm } from "../league-form";

export function NewLeagueClient() {
  const router = useRouter();
  return (
    <LeagueForm
      editing={null}
      onCancel={() => router.push("/leagues")}
      onSaved={(id) => {
        router.push(id ? `/leagues/${id}` : "/leagues");
        router.refresh();
      }}
      saveLabel="Create league"
    />
  );
}
