"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * BDL theme provider. Light-first default; persists the user's choice
 * to localStorage. Uses the `data-theme` attribute (not class) so our
 * tokens in globals.css resolve via `[data-theme="dark"|"light"]`.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="bdl-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
