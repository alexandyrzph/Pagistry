import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Self-contained auth: scrypt password hashing (node:crypto, no deps) +
// opaque database sessions stored in an httpOnly cookie. Published pages stay
// public; the builder UI + its APIs require a session.
// ---------------------------------------------------------------------------

const scrypt = promisify(_scrypt);
const COOKIE = "pc_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (seconds)

export type SessionUser = { id: string; email: string; name: string; onboarded: boolean };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = (stored || "").split(":");
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, "hex");
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return keyBuf.length === buf.length && timingSafeEqual(keyBuf, buf);
}

/** Random URL-safe token for sessions and password resets. */
export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  jar.delete(COOKIE);
}

/** Secure check: resolves the logged-in user from the DB session (memoized per render). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, onboarded: !!u.onboardedAt };
});

/** For server pages: redirect to /login if not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: returns the user or a 401 Response (caller returns it). */
export async function requireApiUser(): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } }) };
  }
  return { user };
}
