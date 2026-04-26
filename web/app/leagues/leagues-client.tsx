import Link from "next/link";
import { Plus } from "lucide-react";

export function LeaguesPageClient({
  canCreate,
  children,
}: {
  canCreate: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {canCreate && (
        <div className="flex items-center justify-end -mt-2">
          <Link
            href="/leagues/new"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} /> Add League
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
