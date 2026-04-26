import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { asc } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import {
  getLeagueContactAccess,
  type ContactAccess,
} from "@/lib/auth/contact-access";
import { getActiveLeagueId } from "@/lib/cookies/active-league";
import {
  getLeagueCommissionerContacts,
  type CommissionerContact,
} from "@/lib/queries/commissioners";
import { db, players } from "@/lib/db";
import { CommissionerAdminControls } from "./commissioner-admin-controls";

/**
 * League commissioner contact strip.
 *
 * Strip visibility — viewer must be a member, commissioner, or admin
 * of the league (handled in getLeagueCommissionerContacts).
 *
 * Cell / email visibility is *view-lensed* via getLeagueContactAccess:
 *   - Admin view (real admin): always shown
 *   - Player or Commissioner view, viewer in league: shown unless private
 *   - Outside the league or wrong view: hidden entirely
 *
 * Inline add/remove admin controls render only in admin view.
 */
export async function CommissionerStrip({ leagueId }: { leagueId?: string }) {
  const session = await readSession();
  const id = leagueId ?? (await getActiveLeagueId());
  if (!id) return null;

  const caps = await getViewCaps(session);
  // Commissioners and admins can both add/remove commissioners for the
  // leagues they manage. The server action re-verifies on submit.
  const hasPerms = !!session && (await canManageLeague(session, id));
  const showAdminControls = caps.canManage && hasPerms;
  const contactAccess = await getLeagueContactAccess(session, id, caps.view);

  const commissioners = await getLeagueCommissionerContacts(id, session);
  if (!commissioners) return null;

  let eligible: { id: string; firstName: string; lastName: string }[] = [];
  if (showAdminControls) {
    const all = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
      })
      .from(players)
      .orderBy(asc(players.lastName), asc(players.firstName));
    const onCommish = new Set(commissioners.map((c) => c.id));
    eligible = all.filter((p) => !onCommish.has(p.id));
  }

  if (commissioners.length === 0 && !showAdminControls) return null;

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-5 py-4">
      <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mb-3">
        Commissioner{commissioners.length === 1 ? "" : "s"}
      </div>
      {commissioners.length === 0 ? (
        <div className="text-[12.5px] text-[color:var(--text-3)] mb-3">
          No commissioners yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {commissioners.map((c) => (
            <Card key={c.id} c={c} access={contactAccess} />
          ))}
        </div>
      )}
      {showAdminControls && (
        <CommissionerAdminControls
          leagueId={id}
          commissioners={commissioners.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
          }))}
          eligible={eligible}
        />
      )}
    </div>
  );
}

function initials(c: CommissionerContact) {
  return `${(c.firstName[0] ?? "?")}${(c.lastName[0] ?? "")}`.toUpperCase();
}

function Card({
  c,
  access,
}: {
  c: CommissionerContact;
  access: ContactAccess;
}) {
  const showCell = access !== "none" && c.cell !== null;
  const showEmail = access !== "none" && c.email !== null;
  return (
    <div className="flex items-center gap-3 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] pl-1 pr-3.5 py-1">
      <Link
        href={`/players/${c.id}`}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-extrabold text-[11px] flex-shrink-0"
        style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
      >
        {initials(c)}
      </Link>
      <div className="flex flex-col gap-0.5 min-w-0">
        <Link
          href={`/players/${c.id}`}
          className="font-bold text-[13.5px] text-[color:var(--text)] hover:text-[color:var(--brand)] truncate"
        >
          {c.firstName} {c.lastName}
        </Link>
        {(showCell || showEmail) && (
          <div className="flex items-center gap-3 text-[11.5px] text-[color:var(--text-3)] flex-wrap">
            {showCell && (
              <Contact
                icon={<Phone size={11} />}
                value={c.cell}
                isPrivate={c.cellPrivate}
                access={access}
                href={c.cell ? `tel:${c.cell}` : undefined}
              />
            )}
            {showEmail && (
              <Contact
                icon={<Mail size={11} />}
                value={c.email}
                isPrivate={c.emailPrivate}
                access={access}
                href={c.email ? `mailto:${c.email}` : undefined}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Contact({
  icon,
  value,
  isPrivate,
  access,
  href,
}: {
  icon: React.ReactNode;
  value: string | null;
  isPrivate: boolean;
  access: ContactAccess;
  href?: string;
}) {
  if (!value) return null;
  // "all" → show value regardless of privacy. "non-private" → show only if not flagged.
  const showValue = access === "all" || (access === "non-private" && !isPrivate);
  const valueEl = showValue ? (
    <a
      href={href}
      className="font-medium text-[color:var(--text-2)] hover:text-[color:var(--brand)]"
    >
      {value}
    </a>
  ) : (
    <span className="text-[color:var(--text-3)]">Hidden</span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[color:var(--text-3)]">{icon}</span>
      {valueEl}
      {isPrivate && (
        <span
          className="ml-0.5 inline-flex items-center px-1.5 py-px rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] uppercase tracking-[0.08em] font-bold"
          style={{ fontSize: 9 }}
        >
          Private
        </span>
      )}
    </span>
  );
}
