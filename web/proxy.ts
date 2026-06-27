/**
 * Route-level guest gate + rolling session renewal. Next.js 16 renamed
 * `middleware` → `proxy` (runtime is Node.js, can't be changed to edge).
 *
 * Two jobs:
 *  1. Coarse guest gate: auth-only routes (admin, settings, edit forms…)
 *     bounce guests to /discover. Per-page server components still do the
 *     real authorization via readSession().
 *  2. Rolling session: on each visit, if a valid session cookie is more
 *     than a day old, re-issue it with a fresh 90-day expiry. A device that
 *     visits at least once every 90 days stays signed in indefinitely —
 *     without ever bypassing the original OTP/login.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/session";

const ALG = "HS256";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const REFRESH_AFTER = 60 * 60 * 24; // re-sign once the token is >1 day old

// Routes that require a session. Anything not matched here is open
// to guests; the page itself decides what to render based on readSession().
const AUTH_REQUIRED_PREFIXES = [
  "/admin",
  "/settings",
  "/roster",
  "/leagues/new",
  "/account",
];
// Specific deeper routes that need auth (edit forms). Kept separate
// so /leagues/[id] (read) stays public.
const AUTH_REQUIRED_REGEX = [
  /^\/leagues\/[^/]+\/edit$/,
  /^\/players\/[^/]+\/edit$/,
  /^\/games\/[^/]+\/invites$/,
];

/** NextResponse.next() with a refreshed session cookie when one is due. */
async function withRollingSession(request: NextRequest): Promise<NextResponse> {
  const res = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const raw = process.env.AUTH_SECRET;
  if (!token || !raw || raw.length < 32) return res;

  try {
    const key = new TextEncoder().encode(raw);
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    const now = Math.floor(Date.now() / 1000);
    const iat = typeof payload.iat === "number" ? payload.iat : 0;
    if (now - iat < REFRESH_AFTER) return res; // still fresh — leave it

    const { adminId, username, role, playerId } = payload as Record<
      string,
      unknown
    >;
    const fresh = await new SignJWT({ adminId, username, role, playerId })
      .setProtectedHeader({ alg: ALG })
      .setIssuedAt()
      .setExpirationTime(now + SESSION_MAX_AGE)
      .sign(key);

    res.cookies.set({
      name: SESSION_COOKIE,
      value: fresh,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  } catch {
    // invalid/expired token — leave it; the page layer treats as logged out
  }
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const res = await withRollingSession(request);

  // Always pass through Next internals, static assets, API routes,
  // and the invite/login flow.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/i/") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return res;
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) return res;

  const needsAuth =
    AUTH_REQUIRED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    ) || AUTH_REQUIRED_REGEX.some((r) => r.test(pathname));

  if (needsAuth) {
    return NextResponse.redirect(new URL("/discover", request.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
