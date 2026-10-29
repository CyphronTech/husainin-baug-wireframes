import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./firebase-admin";
import type { AppUser } from "./types";

export const SESSION_COOKIE = "__session";

// Token → uid lookups cached in this process: saves one Firestore round trip on every request.
// The user doc is still read each time, so deactivation still signs a user out immediately.
// shortcut: entries trusted for up to 60 s. With several server instances, a logout on one instance leaves the
// session usable on another for up to 60 s. Upgrade: shared cache (e.g. Redis) or a signed short-lived cookie.
const sessionCache = new Map<string, { uid: string; until: number }>();
const SESSION_CACHE_MS = 60_000;

/** Login state = a random token in the cookie that points at sessions/{token} in Firestore. */
// shortcut: expired session docs are never deleted. Upgrade: Firestore TTL policy on sessions.expires (console, no code).
export async function startSession(uid: string, remember: boolean) {
  const days = remember ? 14 : 1;
  const token = randomUUID();
  await db.doc(`sessions/${token}`).set({ uid, expires: new Date(Date.now() + days * 864e5) });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember && { maxAge: days * 86400 }),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    sessionCache.delete(token);
    await db.doc(`sessions/${token}`).delete();
  }
  jar.delete(SESSION_COOKIE);
}

export const getUser = cache(async (): Promise<AppUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let hit = sessionCache.get(token);
  if (!hit || hit.until < Date.now()) {
    const session = (await db.doc(`sessions/${token}`).get()).data();
    if (!session) return null;
    hit = { uid: session.uid, until: Math.min(session.expires.toMillis(), Date.now() + SESSION_CACHE_MS) };
    if (sessionCache.size > 1000) for (const [k, v] of sessionCache) if (v.until < Date.now()) sessionCache.delete(k); // stay bounded
    sessionCache.set(token, hit);
  }
  if (hit.until < Date.now()) return null; // session itself expired
  const doc = await db.doc(`users/${hit.uid}`).get();
  // Checked on every request, so deactivating a user signs them out immediately.
  return doc.exists && doc.data()!.active ? ({ uid: doc.id, ...doc.data() } as AppUser) : null;
});

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/bookings");
  return u;
}
