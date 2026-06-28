"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEvent } from "@/lib/actions/organize";

/** Admin-only delete (soft-hide) for an event row. */
export function DeleteEventButton({
  type,
  id,
  name,
}: {
  type: "LEAGUE" | "TOURNAMENT" | "COMMUNITY";
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? It will be hidden from everyone.`)) return;
    start(async () => {
      await deleteEvent(type, id);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Delete ${name}`}
      className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] transition-colors disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  );
}
