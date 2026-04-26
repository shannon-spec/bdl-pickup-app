/**
 * Route-level guest gate. Next.js 16 renamed `middleware` → `proxy`
 * (runtime is Node.js, can't be changed to edge).
 *
 * Rule: guests (no session cookie) can browse the public surface —
 * Discover, the home dashboard, league/game/player detail pages.
 * Auth-only routes (admin, settings, league/game create+edit, the
 * roster manager) bounce guests to /discover, where they can still
 * see the app. Per-page server components do the real authorization
 * checks via readSession() — this proxy is just a coarse hint.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Routes that require a session. Anything not matched here is open
// to guests; the page itself decides what to render based on
// readSession().
const AUTH_REQUIRED_PREFIXES = [
  "/admin",
  "/settings",
  "/roster",
  "/leagues/new",
];
// Specific deeper routes that need auth (edit forms). Kept separate
// so /leagues/[id] (read) stays public.
const AUTH_REQUIRED_REGEX = [
  /^\/leagues\/[^/]+\/edit$/,
  /^\/players\/[^/]+\/edit$/,
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always pass through Next internals, static assets, API routes,
  // and the invite flow.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/invite/") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) return NextResponse.next();

  const needsAuth =
    AUTH_REQUIRED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    AUTH_REQUIRED_REGEX.some((r) => r.test(pathname));

  if (needsAuth) {
    return NextResponse.redirect(new URL("/discover", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
