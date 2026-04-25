"use client";

import Link from "next/link";
import { Bell, LogOut, Search } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "My League", href: "/" },
  { label: "Roster", href: "/roster" },
  { label: "Discover", href: "/discover" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Activity", href: "/activity" },
];

export function TopBar({ active = "/", userInitials = "ST" }: { active?: string; userInitials?: string }) {
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
          {navItems.map((item) => {
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
                  // Below md: hide all but active
                  !isActive && "max-md:hidden",
                  // Below sm: hide entire nav
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
          <SearchPill />
          <ThemeToggle />
          <IconButton aria-label="Notifications">
            <Bell size={16} />
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[color:var(--brand)]"
              style={{ boxShadow: "0 0 0 2px var(--badge-dot-border)" }}
            />
          </IconButton>
          <form action={signOut}>
            <IconButton aria-label="Sign out" type="submit">
              <LogOut size={16} />
            </IconButton>
          </form>
          <AvatarMenu initials={userInitials} />
        </div>
      </div>
    </header>
  );
}

function SearchPill() {
  return (
    <button
      type="button"
      className={cn(
        "max-sm:hidden",
        "inline-flex items-center gap-2 rounded-full h-[34px] px-3",
        "bg-[color:var(--surface)] border border-[color:var(--hairline-2)]",
        "text-[13px] text-[color:var(--text-3)]",
        "hover:text-[color:var(--text)] hover:border-[color:var(--text-4)]",
        "transition-colors",
        "max-md:w-[160px]",
      )}
      aria-label="Search"
    >
      <Search size={14} />
      <span>Search</span>
      <kbd
        className={cn(
          "ml-2 text-[10px] font-[family-name:var(--mono)] text-[color:var(--text-4)]",
          "border border-[color:var(--hairline-2)] rounded px-1 py-[1px] leading-none",
        )}
      >
        ⌘K
      </kbd>
    </button>
  );
}

function IconButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "relative inline-flex items-center justify-center",
        "w-[34px] h-[34px] rounded-[var(--r-lg)]",
        "border border-[color:var(--hairline-2)] bg-[color:var(--surface)]",
        "text-[color:var(--text-2)] hover:text-[color:var(--text)]",
        "transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function AvatarMenu({ initials }: { initials: string }) {
  return (
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
        style={{ background: "linear-gradient(135deg, var(--brand), #8B2FA0)" }}
      >
        {initials}
      </span>
    </button>
  );
}
