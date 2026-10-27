import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./firebase-admin";
import type { AppUser } from "./types";

export const SESSION_COOKIE = "__session";

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
  if (token) await db.doc(`sessions/${token}`).delete();
  jar.delete(SESSION_COOKIE);
}

export const getUser = cache(async (): Promise<AppUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = (await db.doc(`sessions/${token}`).get()).data();
  if (!session || session.expires.toDate() < new Date()) return null;
  const doc = await db.doc(`users/${session.uid}`).get();
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
