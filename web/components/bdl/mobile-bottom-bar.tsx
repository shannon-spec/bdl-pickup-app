import Link from "next/link";
import { Home, Trophy, Compass, User, Check, Trophy as Leagues } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { cn } from "@/lib/utils";

/**
 * Fixed bottom app bar (mobile only). 5 slots; center slot is a
 * brand FAB-style quick action ("I'm In"). The two side slots adapt
 * to the active view — managers get fast access to Leagues / Profile,
 * players see Discover / Profile.
 */
export async function MobileBottomBar({
  active = "home",
}: {
  active?: "home" | "leaderboard" | "discover" | "profile" | "leagues";
}) {
  const session = await readSession();
  const caps = await getViewCaps(session);
  const showLeagues = caps.canManage;

  return (
    <nav
      aria-label="Primary mobile navigation"
      className={cn(
        "sm:hidden",
        "fixed left-0 right-0 bottom-0 z-[var(--z-sticky)]",
        "border-t border-[color:var(--hairline)]",
        "backdrop-blur-[18px] backdrop-saturate-[140%]",
      )}
      style={{
        background: "var(--topbar-bg)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <div className="grid grid-cols-5 items-center h-[56px]">
        <NavItem href="/" icon={<Home size={20} />} label="Home" active={active === "home"} />
        <NavItem href="/leaderboard" icon={<Trophy size={20} />} label="Leaders" active={active === "leaderboard"} />
        <div className="flex justify-center">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center",
              "w-[44px] h-[44px] rounded-full",
              "bg-[color:var(--brand)] text-white",
              "shadow-[var(--cta-shadow)]",
              "transition-transform active:scale-[0.97]",
            )}
            aria-label="I'm In"
          >
            <Check size={22} strokeWidth={2.5} />
          </button>
        </div>
        {showLeagues ? (
          <NavItem
            href="/leagues"
            icon={<Leagues size={20} />}
            label="Leagues"
            active={active === "leagues"}
          />
        ) : (
          <NavItem
            href="/discover"
            icon={<Compass size={20} />}
            label="Discover"
            active={active === "discover"}
          />
        )}
        <NavItem href="/profile" icon={<User size={20} />} label="Profile" active={active === "profile"} />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 h-full",
        active ? "text-[color:var(--text)]" : "text-[color:var(--text-3)]",
      )}
    >
      {icon}
      <span className="text-[10px] font-medium tracking-[0.04em]">{label}</span>
    </Link>
  );
}
