import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, db } from "./firebase-admin";
import type { AppUser } from "./types";

export const SESSION_COOKIE = "__session";

export const getUser = cache(async (): Promise<AppUser | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const { uid } = await auth.verifySessionCookie(cookie, true);
    const doc = await db.doc(`users/${uid}`).get();
    return doc.exists && doc.data()!.active ? ({ uid, ...doc.data() } as AppUser) : null;
  } catch {
    return null;
  }
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
