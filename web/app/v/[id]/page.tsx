import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, MapPin } from "lucide-react";
import { db, venues } from "@/lib/db";
import { Brand } from "@/components/bdl/brand";

export const dynamic = "force-dynamic";

/** Public venue page — "meet here to play". Works logged out. */
export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
  if (!venue) notFound();

  const mapHref =
    venue.lat != null && venue.lng != null
      ? `https://maps.google.com/?q=${venue.lat},${venue.lng}`
      : venue.address
        ? `https://maps.google.com/?q=${encodeURIComponent(venue.address)}`
        : null;

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[440px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 sm:p-8">
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={13} /> Discover
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-[14px] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
            <MapPin size={22} />
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
              Venue
            </div>
            <h1 className="text-[22px] font-extrabold tracking-[-0.02em] truncate">
              {venue.name}
            </h1>
          </div>
        </div>
        {venue.address && (
          <p className="text-[13.5px] text-[color:var(--text-2)] mt-4">{venue.address}</p>
        )}
        {mapHref && (
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center h-11 w-full rounded-[12px] bg-[color:var(--brand)] text-white font-bold text-[13px] tracking-[0.04em] uppercase hover:bg-[color:var(--brand-hover)]"
          >
            Open in Maps
          </a>
        )}
        <div className="mt-8 flex justify-center opacity-70">
          <Brand height={28} />
        </div>
      </div>
    </main>
  );
}
