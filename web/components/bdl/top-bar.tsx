import Link from "next/link";
import { Bell, LogOut, Settings } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { readSession } from "@/lib/auth/session";
import { getViewCaps, type View } from "@/lib/auth/view";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; views: View[] };

const NAV_ITEMS: NavItem[] = [
  { label: "My League", href: "/", views: ["player", "commissioner", "admin"] },
  { label: "Roster", href: "/roster", views: ["admin"] },
  { label: "Leagues", href: "/leagues", views: ["commissioner", "admin"] },
  { label: "Games", href: "/games", views: ["player", "commissioner", "admin"] },
  { label: "Players", href: "/players", views: ["player", "commissioner", "admin"] },
  { label: "Logins", href: "/admin/credentials", views: ["commissioner", "admin"] },
  { label: "Discover", href: "/discover", views: ["player", "commissioner", "admin"] },
  { label: "Leaderboard", href: "/leaderboard", views: ["player", "commissioner", "admin"] },
  { label: "Activity", href: "/activity", views: ["player", "commissioner", "admin"] },
];

export async function TopBar({
  active = "/",
  userInitials = "ST",
}: {
  active?: string;
  userInitials?: string;
}) {
  const session = await readSession();
  const caps = await getViewCaps(session);
  const view = caps.view;

  const visibleNav = NAV_ITEMS.filter((item) => item.views.includes(view));
  const showSettings = view === "admin";
  const isSignedIn = !!session;

  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-sticky)] w-full",
        "border-b border-[color:var(--hairline)]",
        "backdrop-blur-[18px] backdrop-saturate-[140%]",
      )}
      style={{ background: "var(--topbar-bg)" }}
    >
      <div
        className={cn(
          "mx-auto max-w-[1240px]",
          "grid grid-cols-[auto_1fr_auto] items-center",
          "h-[64px] px-[clamp(14px,3vw,28px)]",
          "gap-4",
        )}
      >
        <Link href="/" aria-label="BDL home" className="min-w-0">
          <Brand />
        </Link>

        <nav className="flex items-center justify-center gap-7" aria-label="Primary">
          {visibleNav.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-[13.5px] leading-none font-medium transition-colors",
                  "hover:text-[color:var(--text)]",
                  isActive
                    ? "text-[color:var(--text)] font-semibold"
                    : "text-[color:var(--text-3)]",
                  !isActive && "max-md:hidden",
                  "max-sm:hidden",
                )}
                data-active={isActive || undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {showSettings && (
            <Link
              href="/settings"
              aria-label="Settings"
              className="relative inline-flex items-center justify-center w-[34px] h-[34px] rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)] hover:text-[color:var(--text)] transition-colors"
            >
              <Settings size={16} />
            </Link>
          )}
          <button
            type="button"
            aria-label="Notifications"
            className={cn(
              "relative inline-flex items-center justify-center",
              "w-[34px] h-[34px] rounded-[var(--r-lg)]",
              "border border-[color:var(--hairline-2)] bg-[color:var(--surface)]",
              "text-[color:var(--text-2)] hover:text-[color:var(--text)]",
              "transition-colors",
            )}
          >
            <Bell size={16} />
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[color:var(--brand)]"
              style={{ boxShadow: "0 0 0 2px var(--badge-dot-border)" }}
            />
          </button>
          {isSignedIn ? (
            <>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  className={cn(
                    "relative inline-flex items-center justify-center",
                    "w-[34px] h-[34px] rounded-[var(--r-lg)]",
                    "border border-[color:var(--hairline-2)] bg-[color:var(--surface)]",
                    "text-[color:var(--text-2)] hover:text-[color:var(--text)]",
                    "transition-colors",
                  )}
                >
                  <LogOut size={16} />
                </button>
              </form>
              <button
                type="button"
                aria-label="Account menu"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full h-[38px] pr-3 pl-1",
                  "border border-[color:var(--hairline-2)] bg-[color:var(--surface)]",
                  "hover:border-[color:var(--text-4)] transition-colors",
                )}
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-full text-white font-extrabold text-[11px]"
                  style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
                >
                  {userInitials}
                </span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={cn(
                "inline-flex items-center justify-center h-[34px] px-3 rounded-[var(--r-lg)]",
                "border border-[color:var(--hairline-2)] bg-[color:var(--surface)]",
                "text-[12px] font-bold uppercase tracking-[0.06em]",
                "text-[color:var(--text-2)] hover:text-[color:var(--text)]",
                "transition-colors",
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
