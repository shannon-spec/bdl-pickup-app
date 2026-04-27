"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (next: Theme) => void;
};

const STORAGE_KEY = "bdl-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

// In-house provider so we don't render an inline theme-bootstrap
// <script> inside the React tree (Next 16 / React 19 flag this).
// Light is the default in <html data-theme="light">; dark-mode users
// get a one-frame flash on first paint, which is acceptable.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
