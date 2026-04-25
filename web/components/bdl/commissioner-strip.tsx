import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { asc } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { getActiveLeagueId } from "@/lib/cookies/active-league";
import {
  getLeagueCommissionerContacts,
  type CommissionerContact,
} from "@/lib/queries/commissioners";
import { db, players } from "@/lib/db";
import { CommissionerAdminControls } from "./commissioner-admin-controls";

/**
 * League commissioner contact strip. Renders only when the viewer is
 * a league member, a commissioner, or an admin. Admin-only inline
 * controls (add/remove commissioner) appear when the active view is
 * "admin" — purely a UI lensing decision; the perm checks still gate
 * the actions on the server.
 */
export async function CommissionerStrip({ leagueId }: { leagueId?: string }) {
  const session = await readSession();
  if (!session) return null;
  const id = leagueId ?? (await getActiveLeagueId());
  if (!id) return null;

  const caps = await getViewCaps(session);
  const showAdminControls = caps.view === "admin";

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
            <Card key={c.id} c={c} canSeePrivate={caps.view === "admin"} />
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
  canSeePrivate,
}: {
  c: CommissionerContact;
  canSeePrivate: boolean;
}) {
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
        <div className="flex items-center gap-3 text-[11.5px] text-[color:var(--text-3)] flex-wrap">
          <Contact
            icon={<Phone size={11} />}
            value={c.cell}
            isPrivate={c.cellPrivate}
            canSeePrivate={canSeePrivate}
            href={c.cell ? `tel:${c.cell}` : undefined}
          />
          <Contact
            icon={<Mail size={11} />}
            value={c.email}
            isPrivate={c.emailPrivate}
            canSeePrivate={canSeePrivate}
            href={c.email ? `mailto:${c.email}` : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function Contact({
  icon,
  value,
  isPrivate,
  canSeePrivate,
  href,
}: {
  icon: React.ReactNode;
  value: string | null;
  isPrivate: boolean;
  canSeePrivate: boolean;
  href?: string;
}) {
  if (!value) return null;
  const showValue = !isPrivate || canSeePrivate;
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
