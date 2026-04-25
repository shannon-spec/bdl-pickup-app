/**
 * Route-level auth gate. Next.js 16 renamed `middleware` → `proxy`
 * (runtime is Node.js, can't be changed to edge).
 *
 * Rule: any request outside the public allowlist without a valid
 * session cookie redirects to /login.
 *
 * The cookie value is only checked for presence here (cheap, no
 * crypto). Real verification happens inside server actions /
 * route handlers / layouts via readSession() — that's where a
 * forged cookie is rejected.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = [
  "/login",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow Next internals, static assets, API routes
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
