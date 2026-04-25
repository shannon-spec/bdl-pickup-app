import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getActiveLeagueId } from "@/lib/cookies/active-league";
import {
  getLeagueCommissionerContacts,
  type CommissionerContact,
} from "@/lib/queries/commissioners";

/**
 * League commissioner contact strip. Mount on any page that has a
 * league context — only renders when the viewer is allowed to see
 * commissioners (league member, commissioner, or admin).
 *
 * If `leagueId` is not provided, falls back to the active-league cookie.
 */
export async function CommissionerStrip({ leagueId }: { leagueId?: string }) {
  const session = await readSession();
  if (!session) return null;
  const id = leagueId ?? (await getActiveLeagueId());
  if (!id) return null;
  const isAdmin = session.role === "owner" || session.role === "super_admin";
  const commissioners = await getLeagueCommissionerContacts(id, session);
  if (!commissioners || commissioners.length === 0) return null;

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-5 py-4">
      <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mb-3">
        Commissioner{commissioners.length === 1 ? "" : "s"}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {commissioners.map((c) => (
          <Card key={c.id} c={c} canSeePrivate={isAdmin} />
        ))}
      </div>
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
  // Hide value from non-admins when flagged private
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
