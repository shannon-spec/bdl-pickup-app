import Link from "next/link";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { Bell, LogOut, Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { BasketballIcon } from "./sport-icons";
import { signOut } from "@/lib/auth/actions";
import { readSession } from "@/lib/auth/session";
import { getViewCaps, type View } from "@/lib/auth/view";
import { db, players } from "@/lib/db";
import { getUnreadAnnouncementCount } from "@/lib/queries/announcements";
import { getUnreadMessageCount } from "@/lib/queries/messages";
import { MoreMenu } from "./top-bar-more";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  views: View[];
  /** Hide from guests (no session). Profile-oriented surfaces. */
  signedInOnly?: boolean;
  /** Small badge after the label, e.g. "beta". */
  badge?: string;
};

const LOCKUP_RATIO = 947 / 321; // aspect ratio of bdl-lockup-*.png (BDL x rivals)

/** Dark hero scene shared with the Front Door, scoped to the header. */
const HERO_SCENE: React.CSSProperties = {
  backgroundColor: "#0A0E14",
  backgroundImage:
    "linear-gradient(180deg, rgba(8,11,16,.86) 0%, rgba(8,11,16,.92) 100%), url(/hero-court.jpg)",
  backgroundSize: "cover, cover",
  backgroundPosition: "center, center 22%",
};

/** Dark-on-dark control button (theme/bell/sign-out) for the hero header. */
const DARK_CTRL =
  "border border-white/15 bg-white/10 text-white/80 hover:text-white hover:bg-[rgba(120,185,255,0.38)] hover:border-[rgba(120,185,255,0.55)] transition-colors";

// Primary nav — the few things most people want; the context switcher
// (under the bar) handles which league/team is active.
const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/home", views: ["player", "commissioner", "admin"], signedInOnly: true },
  { label: "Discover", href: "/discover", views: ["player", "commissioner", "admin"] },
  { label: "Leaderboard", href: "/leaderboard", views: ["player", "commissioner", "admin"] },
  { label: "Manage", href: "/manage", views: ["player", "commissioner", "admin"], signedInOnly: true },
];

// Everything else lives under the "More ▾" overflow menu.
const MORE_NAV: NavItem[] = [
  { label: "Games", href: "/games", views: ["player", "commissioner", "admin"] },
  { label: "Training", href: "/training", views: ["player", "commissioner", "admin"], signedInOnly: true, badge: "beta" },
  { label: "Players", href: "/players", views: ["player", "commissioner", "admin"] },
  { label: "Stats", href: "/stats", views: ["player", "commissioner", "admin"], badge: "beta" },
  { label: "Activity", href: "/activity", views: ["player", "commissioner", "admin"] },
  { label: "Sponsorships", href: "/sponsor", views: ["player", "commissioner", "admin"], signedInOnly: true },
  { label: "Leagues", href: "/leagues", views: ["commissioner", "admin"] },
  { label: "Commissioners", href: "/admin/commissioners", views: ["admin"] },
];

export async function TopBar({
  active = "/",
}: {
  active?: string;
}) {
  const session = await readSession();
  const caps = await getViewCaps(session);
  const view = caps.view;

  const isSignedIn = !!session;
  const canSee = (item: NavItem) =>
    item.views.includes(view) && (isSignedIn || !item.signedInOnly);
  const nav = PRIMARY_NAV.filter(canSee);
  const moreItems = MORE_NAV.filter(canSee).map((i) => ({
    label: i.label,
    href: i.href,
    badge: i.badge,
  }));

  const showSettings = view === "admin";

  // Avatar for the signed-in player. Super admins without a linked
  // player don't get an account avatar (they manage their auth via
  // ADMIN_SHARED_PASSWORD env, not /account).
  let avatar: { initials: string; url: string | null } | null = null;
  if (session?.playerId) {
    const [me] = await db
      .select({
        firstName: players.firstName,
        lastName: players.lastName,
        avatarUrl: players.avatarUrl,
      })
      .from(players)
      .where(eq(players.id, session.playerId))
      .limit(1);
    if (me) {
      avatar = {
        initials: `${me.firstName[0] ?? ""}${me.lastName[0] ?? ""}`.toUpperCase(),
        url: me.avatarUrl,
      };
    }
  }

  // Bell badge — combined unread count across announcements and DMs.
  // Skipped for guests / unlinked admins (no playerId, no inbox).
  const unreadCount = session?.playerId
    ? (await getUnreadAnnouncementCount(session.playerId)) +
      (await getUnreadMessageCount(session.playerId))
    : 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-sticky)] w-full",
        "border-b border-white/10 text-white",
      )}
      style={HERO_SCENE}
    >
      {/* faint basketball scene element — clipped to the bar so it doesn't
          overflow, while leaving the header free to show dropdowns. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <BasketballIcon
          size={150}
          className="absolute -right-6 -top-10 opacity-[0.10] text-white"
        />
      </div>
      <div
        className={cn(
          "relative z-10 mx-auto max-w-[1240px]",
          "grid grid-cols-[auto_1fr_auto] items-center",
          "h-[64px] px-[clamp(14px,3vw,28px)]",
          "gap-4",
        )}
      >
        <Link href="/home" aria-label="BDL home" className="min-w-0">
          <Image
            src="/bdl-lockup-dark.png"
            alt="BDL · Ball Don't Lie"
            width={Math.round(38 * LOCKUP_RATIO)}
            height={38}
            priority
            style={{ height: 38, width: "auto" }}
          />
        </Link>

        <nav className="flex items-center justify-center gap-1" aria-label="Primary">
          {nav.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-[10px] text-[12px] leading-none font-bold uppercase tracking-[0.07em] transition-colors",
                  "hover:bg-[rgba(120,185,255,0.38)] hover:text-white",
                  isActive
                    ? "bg-[rgba(120,185,255,0.44)] text-white"
                    : "text-white/55",
                  !isActive && "max-md:hidden",
                  "max-sm:hidden",
                )}
                data-active={isActive || undefined}
              >
                {item.label}
              </Link>
            );
          })}
          <MoreMenu items={moreItems} active={active} />
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className={DARK_CTRL} />
          {showSettings && (
            <Link
              href="/admin"
              aria-label="Admin"
              className={cn(
                "relative inline-flex items-center justify-center w-[34px] h-[34px] rounded-[var(--r-lg)]",
                DARK_CTRL,
              )}
            >
              <Settings size={16} />
            </Link>
          )}
          <Link
            href="/messages"
            aria-label={
              unreadCount > 0
                ? `Message Center · ${unreadCount} unread`
                : "Message Center"
            }
            title={
              unreadCount > 0
                ? `Message Center · ${unreadCount} unread`
                : "Message Center"
            }
            className={cn(
              "relative inline-flex items-center justify-center",
              "w-[34px] h-[34px] rounded-[var(--r-lg)]",
              DARK_CTRL,
            )}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, #FFB070, #FF3D00 60%)",
                  boxShadow:
                    "0 0 0 2px var(--badge-dot-border), 0 0 10px rgba(255,61,0,.95), 0 0 18px rgba(255,90,0,.55)",
                }}
              />
            )}
          </Link>
          {avatar &&
            (avatar.url ? (
              <Link
                href="/account"
                aria-label="Account"
                className="relative inline-flex items-center justify-center w-[34px] h-[34px] rounded-full overflow-hidden border border-white/20 hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar.url}
                  alt=""
                  width={34}
                  height={34}
                  className="w-full h-full object-cover"
                />
              </Link>
            ) : (
              <Link
                href="/account"
                aria-label="Account"
                className="relative inline-flex items-center justify-center w-[34px] h-[34px] rounded-full text-white font-extrabold text-[11px] leading-none shadow-[0_1px_0_rgba(0,0,0,0.06)] hover:opacity-90 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand), var(--brand-2))",
                }}
              >
                {avatar.initials}
              </Link>
            ))}
          {isSignedIn ? (
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className={cn(
                  "relative inline-flex items-center justify-center",
                  "w-[34px] h-[34px] rounded-[var(--r-lg)]",
                  DARK_CTRL,
                )}
              >
                <LogOut size={16} />
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className={cn(
                "inline-flex items-center justify-center h-[34px] px-3 rounded-[var(--r-lg)]",
                "text-[12px] font-bold uppercase tracking-[0.06em]",
                DARK_CTRL,
              )}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
