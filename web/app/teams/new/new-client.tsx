"use client";

import { useRouter } from "next/navigation";
import { TeamForm } from "../team-form";

export function NewTeamClient() {
  const router = useRouter();
  return (
    <TeamForm
      editing={null}
      onCancel={() => router.push("/")}
      onSaved={(id) => {
        router.push(id ? `/teams/${id}` : "/");
        router.refresh();
      }}
      saveLabel="Create team"
    />
  );
}
