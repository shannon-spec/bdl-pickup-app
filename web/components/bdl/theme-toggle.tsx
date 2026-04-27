"use client";

import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — render a blank shell until mounted,
  // then swap in the correct icon.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex items-center justify-center",
        "w-[34px] h-[34px] rounded-[var(--r-lg)]",
        "border border-[color:var(--hairline-2)] bg-[color:var(--surface)]",
        "text-[color:var(--text-2)] hover:text-[color:var(--text)]",
        "transition-colors",
        className,
      )}
    >
      {mounted ? (isDark ? <Sun size={16} /> : <Moon size={16} />) : null}
    </button>
  );
}
