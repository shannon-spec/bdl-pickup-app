import Link from "next/link";
import { Bell, LogOut, Settings } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { readSession } from "@/lib/auth/session";
import { getViewCaps, type View } from "@/lib/auth/view";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  views: View[];
  /** Hide from guests (no session). Profile-oriented surfaces. */
  signedInOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "My League", href: "/", views: ["player", "commissioner"], signedInOnly: true },
  { label: "Leagues", href: "/leagues", views: ["commissioner", "admin"] },
  { label: "Games", href: "/games", views: ["player", "commissioner", "admin"] },
  { label: "Players", href: "/players", views: ["player", "commissioner", "admin"] },
  { label: "Commissioners", href: "/admin/commissioners", views: ["admin"] },
  { label: "Logins", href: "/admin/credentials", views: ["commissioner", "admin"] },
  { label: "Discover", href: "/discover", views: ["player", "commissioner", "admin"] },
  { label: "Leaderboard", href: "/leaderboard", views: ["player", "commissioner", "admin"] },
  { label: "Activity", href: "/activity", views: ["player", "commissioner", "admin"] },
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
  const visibleNav = NAV_ITEMS.filter(
    (item) => item.views.includes(view) && (isSignedIn || !item.signedInOnly),
  );
  const showSettings = view === "admin";

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
              href="/admin"
              aria-label="Admin"
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
