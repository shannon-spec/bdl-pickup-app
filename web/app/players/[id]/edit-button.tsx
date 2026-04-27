import Link from "next/link";
import { Pencil } from "lucide-react";

export function EditPlayerButton({ playerId }: { playerId: string }) {
  return (
    <Link
      href={`/players/${playerId}/edit`}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] transition-colors flex-shrink-0"
    >
      <Pencil size={14} strokeWidth={2.5} /> Edit Profile
    </Link>
  );
}
