import Link from "next/link";
import { Pencil } from "lucide-react";

export function EditPlayerButton({ playerId }: { playerId: string }) {
  return (
    <Link
      href={`/players/${playerId}/edit`}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-medium hover:bg-[color:var(--surface-2)] transition-colors flex-shrink-0"
    >
      <Pencil size={14} /> Edit
    </Link>
  );
}
