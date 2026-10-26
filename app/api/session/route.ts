import { NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { SESSION_COOKIE } from "@/lib/session";

const MAX_AGE = 60 * 60 * 24 * 5; // 5 days

export async function POST(req: Request) {
  const { idToken } = await req.json();
  const { uid } = await auth.verifyIdToken(idToken);
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists || !user.data()!.active) return NextResponse.json({ error: "No active account" }, { status: 403 });
  const cookie = await auth.createSessionCookie(idToken, { expiresIn: MAX_AGE * 1000 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: MAX_AGE, path: "/" });
  return res;
}
