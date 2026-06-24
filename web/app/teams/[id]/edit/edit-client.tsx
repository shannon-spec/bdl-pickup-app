"use client";

import { useRouter } from "next/navigation";
import type { Team } from "@/lib/db";
import { TeamForm } from "../../team-form";

export function EditTeamClient({ team }: { team: Team }) {
  const router = useRouter();
  return (
    <TeamForm
      editing={team}
      onCancel={() => router.push(`/teams/${team.id}`)}
      onSaved={(id) => {
        router.push(`/teams/${id || team.id}`);
        router.refresh();
      }}
      saveLabel="Save changes"
    />
  );
}
