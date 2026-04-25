import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronUp } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { StatBlock, StatRow } from "@/components/bdl/stat-block";
import { getPlayerProfile } from "@/lib/queries/player-profile";
import { EditPlayerButton } from "./edit-button";
import type { Player as PlayerType } from "@/lib/db";

export const dynamic = "force-dynamic";

const fmtWDUpper = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return `${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()]} · ${
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getMonth()]
  } ${d.getDate()}`;
};

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const profile = await getPlayerProfile(id);
  if (!profile) notFound();

  const { player } = profile;
  const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase();
  const isMe = session.playerId === player.id;
  const isAdmin = session.role === "owner" || session.role === "super_admin";

  return (
    <>
      <TopBar
        active="/roster"
        userInitials={session.username.slice(0, 2).toUpperCase()}
      />
      <PageFrame>
        <Link
          href="/roster"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Roster
        </Link>

        <div className="flex items-start gap-4 max-sm:flex-col max-sm:items-start">
          <span
            className="inline-flex items-center justify-center w-16 h-16 rounded-full text-white font-extrabold text-[20px] flex-shrink-0"
            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
          >
            {initials}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] flex items-center gap-2">
              Player Profile
              {isMe && <Pill tone="brand">You</Pill>}
            </div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
              {player.firstName} {player.lastName}
            </h1>
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Pill
                tone={
                  player.status === "Active"
                    ? "win"
                    : player.status === "IR"
                    ? "loss"
                    : "neutral"
                }
                dot={player.status === "Active"}
              >
                {player.status}
              </Pill>
              {player.level && player.level !== "Not Rated" && (
                <Pill tone="brand">{player.level}</Pill>
              )}
              {player.position && <Pill tone="neutral">{player.position}</Pill>}
              {player.city && (
                <span className="text-[12px] text-[color:var(--text-3)]">
                  {player.city}
                  {player.state ? `, ${player.state}` : ""}
                </span>
              )}
            </div>
          </div>
          {isAdmin && <EditPlayerButton playerId={player.id} />}
        </div>

        {/* Career stats */}
        <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 pt-6 pb-5 max-sm:px-5">
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mb-6">
            Career · All Leagues
          </div>
          <StatRow>
            <StatBlock
              label="Win %"
              value={profile.totalWinPct !== null ? profile.totalWinPct.toFixed(1) : "—"}
              unit={profile.totalWinPct !== null ? "%" : undefined}
              sub={{ text: `${profile.totalGames} games played` }}
            />
            <StatBlock
              label="Record"
              value={
                <span>
                  {profile.totalWins}
                  <span className="text-[color:var(--text-4)] font-bold mx-[-2px]">–</span>
                  {profile.totalLosses}
                </span>
              }
              sub={{ text: `${profile.totalWins + profile.totalLosses} decisions` }}
            />
            <StatBlock
              label="Streak"
              value={
                profile.streakType
                  ? `${profile.streakType}${profile.streakCount}`
                  : "—"
              }
              valueClassName={
                profile.streakType === "W"
                  ? "text-[color:var(--up)]"
                  : profile.streakType === "L"
                  ? "text-[color:var(--down)]"
                  : undefined
              }
              sub={
                profile.streakType
                  ? {
                      text: `${profile.streakCount} straight ${profile.streakType === "W" ? "win" : "loss"}${profile.streakCount === 1 ? "" : profile.streakType === "W" ? "s" : "es"}`,
                      tone: profile.streakType === "W" ? "up" : "down",
                      icon: profile.streakType === "W" ? <ChevronUp size={10} /> : undefined,
                    }
                  : { text: "No games yet", tone: "muted" }
              }
            />
            <StatBlock
              label="Leagues"
              value={profile.leagueCount}
              sub={{ text: profile.leagueCount === 1 ? "1 active" : `${profile.leagueCount} active` }}
            />
          </StatRow>
        </section>

        {/* Per-league breakdown */}
        {profile.byLeague.length > 0 && (
          <div>
            <SectionHead title="By League" count={<span>{profile.byLeague.length}</span>} />
            <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
              {profile.byLeague.map((s) => (
                <Link
                  key={s.leagueId}
                  href={`/leagues/${s.leagueId}`}
                  className="grid grid-cols-[1fr_80px_60px_60px] max-sm:grid-cols-[1fr_70px_60px] items-center gap-3 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] text-[14px]"
                >
                  <span className="font-bold truncate">{s.leagueName}</span>
                  <span className="font-[family-name:var(--mono)] num text-[12px] text-[color:var(--text-3)] text-right">
                    {s.wins}-{s.losses}
                  </span>
                  <span className="font-extrabold num text-right max-sm:hidden">
                    {s.pct !== null ? `${s.pct.toFixed(1)}%` : "—"}
                  </span>
                  <span className="font-[family-name:var(--mono)] num text-[12px] text-[color:var(--text-3)] text-right">
                    {s.rank !== null ? `#${s.rank}` : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Last 10 */}
        {profile.lastN.length > 0 && (
          <div>
            <SectionHead title="Last 10" count={<span>{profile.lastN.length}</span>} />
            <div
              className="grid gap-3 overflow-x-auto"
              style={{
                gridAutoFlow: "column",
                gridAutoColumns: "minmax(170px, 1fr)",
              }}
            >
              {profile.lastN.map((g) => (
                <Link
                  key={g.id}
                  href={`/games/${g.id}`}
                  className="flex flex-col gap-2.5 p-4 rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] min-w-[170px] hover:border-[color:var(--text-4)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
                      {fmtWDUpper(g.date)}
                    </span>
                    <Pill tone={g.isWin ? "win" : "loss"}>{g.isWin ? "Won" : "Lost"}</Pill>
                  </div>
                  <div className="font-[family-name:var(--mono)] font-extrabold text-[22px] num inline-flex items-baseline gap-2">
                    {g.myScore !== null && g.opScore !== null ? (
                      <>
                        <span
                          className={
                            g.isWin
                              ? "text-[color:var(--text)]"
                              : "text-[color:var(--text-3)]"
                          }
                        >
                          {g.myScore}
                        </span>
                        <span className="text-[color:var(--text-4)] font-medium">—</span>
                        <span
                          className={
                            !g.isWin
                              ? "text-[color:var(--text)]"
                              : "text-[color:var(--text-3)]"
                          }
                        >
                          {g.opScore}
                        </span>
                      </>
                    ) : (
                      <span className="text-[color:var(--text-3)]">—</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-[color:var(--text-3)]">
                    vs {g.opName}
                    {g.leagueName ? ` · ${g.leagueName}` : ""}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Contact (admins/commissioners only get to see PII; we show what's not flagged private) */}
        {/* Player info + contact (side-by-side cards) */}
        <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">
          <PlayerInfoCard player={player} />
          <ContactCard player={player} />
        </div>
      </PageFrame>
      <MobileBottomBar active="profile" />
    </>
  );
}

const fmtBirthday = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
};

const ageFromBirthday = (d: string | null): number | null => {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dt.getFullYear();
  const m = today.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dt.getDate())) age--;
  return age;
};

const fmtHeight = (ft: number | null, inch: number | null): string | null => {
  if (ft === null && inch === null) return null;
  const f = ft ?? 0;
  const i = inch ?? 0;
  // Show "6'4.5\"" — drop trailing .0
  const inStr = Number.isInteger(i) ? String(i) : String(i);
  return `${f}'${inStr}"`;
};

function PlayerInfoCard({ player }: { player: PlayerType }) {
  const birthday = fmtBirthday(player.birthday);
  const age = ageFromBirthday(player.birthday);
  const height = fmtHeight(player.heightFt, player.heightIn);
  const hometown = player.city
    ? `${player.city}${player.state ? `, ${player.state}` : ""}`
    : null;
  const zip = player.zip;

  // Hide the whole card if there's nothing to show.
  const hasAny =
    birthday ||
    age !== null ||
    height ||
    player.weight !== null ||
    hometown ||
    zip ||
    player.college ||
    player.sport ||
    player.highestLevel;
  if (!hasAny) return null;

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6">
      <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)] flex items-center gap-2 mb-5">
        <span aria-hidden className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]" />
        Player Info
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 max-sm:grid-cols-1">
        {birthday && <Field label="Birthday" value={birthday} />}
        {age !== null && <Field label="Age" value={String(age)} />}
        {height && <Field label="Height" value={height} />}
        {player.weight !== null && (
          <Field label="Weight" value={`${player.weight} lbs`} />
        )}
        {hometown && <Field label="Hometown" value={hometown} />}
        {zip && <Field label="ZIP" value={zip} mono />}
        {player.college && <Field label="College" value={player.college} />}
        {player.sport && <Field label="Sport" value={player.sport} />}
        {player.highestLevel && (
          <Field label="Highest Level" value={player.highestLevel} />
        )}
      </div>
    </div>
  );
}

function ContactCard({ player }: { player: PlayerType }) {
  const showEmail = player.email && !player.emailPrivate;
  const showCell = player.cell && !player.cellPrivate;
  if (!showEmail && !showCell && !player.emailPrivate && !player.cellPrivate) {
    return null;
  }

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6">
      <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)] flex items-center gap-2 mb-5">
        <span aria-hidden className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]" />
        Contact
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 max-sm:grid-cols-1">
        <ContactField
          label="Cell"
          value={player.cell}
          isPrivate={player.cellPrivate}
          href={player.cell ? `tel:${player.cell}` : undefined}
        />
        <ContactField
          label="Email"
          value={player.email}
          isPrivate={player.emailPrivate}
          href={player.email ? `mailto:${player.email}` : undefined}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      <span
        className={`font-bold text-[15.5px] text-[color:var(--text)] ${mono ? "font-[family-name:var(--mono)] num" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function ContactField({
  label,
  value,
  isPrivate,
  href,
}: {
  label: string;
  value: string | null;
  isPrivate: boolean;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] flex items-center gap-2">
        <span>{label}</span>
        {isPrivate && (
          <span className="text-[9.5px] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
            Private
          </span>
        )}
      </span>
      {value && !isPrivate ? (
        <a
          href={href}
          className="font-bold text-[15.5px] text-[color:var(--text)] hover:text-[color:var(--brand)]"
        >
          {value}
        </a>
      ) : (
        <span className="font-medium text-[14px] text-[color:var(--text-3)]">
          {value ? "Hidden" : "—"}
        </span>
      )}
    </div>
  );
}
