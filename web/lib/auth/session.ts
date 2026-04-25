/**
 * Session: jose-signed JWT in an httpOnly cookie.
 *
 * Payload carries the minimum needed to render without a DB hit —
 * super admin username, role, and optional linked player. Routes
 * that need fresh data always re-query by id.
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "bdl_session";
const ALG = "HS256";

export type Session = {
  /**
   * super_admins.id for admin sessions; empty string for player sessions.
   * Existing helpers/queries treat the empty string as "no admin row".
   */
  adminId: string;
  username: string;
  /** "player" was added to support per-player credential logins. */
  role: "owner" | "super_admin" | "player";
  playerId: string | null;
  iat: number;
  exp: number;
};

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or is <32 chars. Set it in Vercel env + .env.local.",
    );
  }
  return new TextEncoder().encode(raw);
}

export async function createSession(
  data: Pick<Session, "adminId" | "username" | "role" | "playerId">,
  maxAgeSeconds = 60 * 60 * 24 * 30, // 30 days
): Promise<string> {
  const jwt = await new SignJWT(data as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(getSecret());
  return jwt;
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (
      typeof payload.adminId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      (payload.playerId !== null && typeof payload.playerId !== "string") ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function writeSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export const SESSION_COOKIE = COOKIE;

/** Throws when the caller isn't a signed-in admin. Use in server actions. */
export async function requireAdmin(): Promise<Session> {
  const session = await readSession();
  if (!session) {
    throw new Error("Not authenticated.");
  }
  if (session.role !== "owner" && session.role !== "super_admin") {
    throw new Error("Forbidden — admin role required.");
  }
  return session;
}

/** Any signed-in user (admin or player). */
export async function requireUser(): Promise<Session> {
  const session = await readSession();
  if (!session) throw new Error("Not authenticated.");
  return session;
}

/** Same as requireAdmin but only owners pass. */
export async function requireOwner(): Promise<Session> {
  const session = await readSession();
  if (!session) throw new Error("Not authenticated.");
  if (session.role !== "owner") throw new Error("Forbidden — owner role required.");
  return session;
}
