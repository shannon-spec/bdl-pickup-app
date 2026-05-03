import { ExternalLink, MapPin } from "lucide-react";

/**
 * League venue card — gym name, court, address, and a Google Maps
 * embed when GOOGLE_MAPS_EMBED_KEY is configured. Without a key the
 * map area gracefully degrades to "Open in Google Maps" link only,
 * so the card still works in dev / on env-misconfigured deploys.
 *
 * The Embed API has a free tier with no billing required for normal
 * use — see https://developers.google.com/maps/documentation/embed.
 */
export function LeagueVenueCard({
  venueName,
  venueCourt,
  venueAddress,
  venueLat,
  venueLng,
}: {
  venueName: string | null;
  venueCourt: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
}) {
  // Render nothing when no venue info exists at all — keeps the page
  // clean for leagues that haven't filled in a location yet.
  if (!venueName && !venueCourt && !venueAddress && venueLat === null) {
    return null;
  }

  // Pin precedence: explicit coordinates > address. Coords win because
  // they target the specific gym door on big campuses where address
  // geocoding lands at the property edge.
  const hasCoords = venueLat !== null && venueLng !== null;
  const pinQuery = hasCoords
    ? `${venueLat},${venueLng}`
    : (venueAddress ?? "").trim();

  const apiKey = process.env.GOOGLE_MAPS_EMBED_KEY;
  const embedUrl =
    apiKey && pinQuery
      ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(pinQuery)}`
      : null;
  const externalUrl = pinQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pinQuery)}`
    : null;

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
      {embedUrl ? (
        <iframe
          title={`Map of ${venueName ?? venueAddress ?? "venue"}`}
          src={embedUrl}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-[260px] border-0 block"
        />
      ) : venueAddress ? (
        <div
          className="w-full h-[160px] flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-soft), transparent 65%), var(--surface-2)",
          }}
        >
          <div className="text-[12px] text-[color:var(--text-3)] text-center px-6">
            Set <code>GOOGLE_MAPS_EMBED_KEY</code> in env to render the map
            here.
          </div>
        </div>
      ) : null}

      <div className="px-5 py-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <MapPin
            size={14}
            className="text-[color:var(--brand)] flex-shrink-0"
          />
          <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
            Venue
          </span>
        </div>
        {venueName && (
          <div className="font-bold text-[16px] text-[color:var(--text)] tracking-[-0.01em]">
            {venueName}
          </div>
        )}
        {venueCourt && (
          <div className="text-[12.5px] text-[color:var(--text-2)]">
            {venueCourt}
          </div>
        )}
        {venueAddress && (
          <div className="flex items-center justify-between gap-3 mt-1">
            <span className="text-[12.5px] text-[color:var(--text-3)] min-w-0 truncate">
              {venueAddress}
            </span>
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.04em] uppercase text-[color:var(--brand)] hover:text-[color:var(--brand-hover)] flex-shrink-0"
              >
                Open in Maps <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
