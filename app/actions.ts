"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cancelPending, createBooking, decideCancellation, deleteBlock, getBooking, markPaid, requestCancellation, saveBlock, audit } from "@/lib/booking";
import { getSectors, getVenues } from "@/lib/data";
import { auth, db } from "@/lib/firebase-admin";
import { createPaymentLink, mockPayments } from "@/lib/razorpay";
import { requireAdmin, requireUser, SESSION_COOKIE } from "@/lib/session";
import type { Block, Slot } from "@/lib/types";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => (s(f, k) === "" ? undefined : Number(s(f, k)));
const mobile10 = (m: string) => {
  const d = m.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) throw new Error("Mobile must be 10 digits");
  return d;
};

/** Run, then redirect back with ?msg= on failure. redirect() throws, so it must stay outside try. */
async function run(back: string, fn: () => Promise<string | void>) {
  let to = back;
  try {
    to = (await fn()) || back;
  } catch (e) {
    to = `${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent((e as Error).message)}`;
  }
  redirect(to);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ── Bookings ────────────────────────────────────────────────────────────────

export async function newBooking(f: FormData) {
  const user = await requireUser();
  await run(`/bookings?${s(f, "back")}`, async () => {
    const sectorId = user.role === "admin" ? s(f, "sectorId") : user.sectorId!;
    const sector = (await getSectors()).find((x) => x.id === sectorId);
    if (!sector) throw new Error("Select a Sector / Mohalla");
    const id = await createBooking(user, {
      venueIds: f.getAll("venueIds").map(String),
      from: s(f, "from"),
      to: s(f, "to") || s(f, "from"),
      slot: s(f, "slot") as Slot,
      sectorId,
      sectorName: sector.name,
      household: { name: s(f, "hhName"), hof: s(f, "hof"), mobile: mobile10(s(f, "hhMobile")) },
    });
    await sendLink(id).catch(() => {}); // booking + hold stand even if Razorpay is down; retry from booking page
    return `/bookings/${id}`;
  });
}

async function sendLink(id: string) {
  const b = (await getBooking(id))!;
  if (b.status !== "pending" || b.payment) return;
  const link = await createPaymentLink(b);
  await db.doc(`bookings/${id}`).update({ payment: { linkId: link.id, url: link.url } });
}

export async function retryPaymentLink(f: FormData) {
  await requireUser();
  const id = s(f, "id");
  await run(`/bookings/${id}`, () => sendLink(id));
}

export async function releaseBooking(f: FormData) {
  const user = await requireUser();
  const id = s(f, "id");
  await run(`/bookings/${id}`, () => cancelPending(user, id));
}

export async function requestCancel(f: FormData) {
  const user = await requireUser();
  const id = s(f, "id");
  await run(`/bookings/${id}`, () => requestCancellation(user, id, s(f, "reason")));
}

export async function mockPay(f: FormData) {
  if (!mockPayments) throw new Error("Mock payments disabled");
  const linkId = s(f, "linkId");
  await markPaid(linkId, `pay_mock_${Date.now()}`, s(f, "method"));
  const b = await db.collection("bookings").where("payment.linkId", "==", linkId).limit(1).get();
  redirect(`/r/${b.docs[0].id}`);
}

// ── Admin: cancellations ────────────────────────────────────────────────────

export async function decideCancel(f: FormData) {
  const admin = await requireAdmin();
  await run("/cancellations", () =>
    decideCancellation(
      admin,
      s(f, "id"),
      s(f, "decision") === "approve",
      s(f, "comment"),
      n(f, "refundAmount") ? { amount: n(f, "refundAmount")!, date: s(f, "refundDate"), mode: s(f, "refundMode"), reference: s(f, "refundRef") } : undefined,
    ),
  );
}

// ── Admin: venues ───────────────────────────────────────────────────────────

export async function saveVenue(f: FormData) {
  const admin = await requireAdmin();
  await run("/venues", async () => {
    const id = s(f, "id");
    const type = s(f, "type") as "hall" | "room";
    const rates =
      type === "hall"
        ? { morning: n(f, "morning"), evening: n(f, "evening"), fullDay: n(f, "fullDay"), multiDay: n(f, "multiDay") }
        : { perDay: n(f, "perDay") };
    const data = {
      name: s(f, "name"),
      code: s(f, "code").toUpperCase(),
      type,
      capacity: n(f, "capacity") ?? 0,
      morningTime: s(f, "morningTime"),
      eveningTime: s(f, "eveningTime"),
      rates: JSON.parse(JSON.stringify(rates)), // drop undefined (Firestore rejects it)
      active: f.get("active") === "on",
    };
    const ref = id ? db.doc(`venues/${id}`) : db.collection("venues").doc();
    // Bookings snapshot their rate per item at creation, so changing rates here never touches existing bookings.
    await db.runTransaction(async (tx) => {
      const before = (await tx.get(ref)).data();
      tx.set(ref, data);
      audit(tx, admin, id ? "venue.update" : "venue.create", { venueId: ref.id, before: before?.rates, after: data.rates });
    });
  });
}

function blockFrom(f: FormData, kind: Block["kind"]) {
  return {
    kind,
    name: s(f, "name"),
    from: s(f, "from"),
    to: s(f, "to") || s(f, "from"),
    slot: (s(f, "slot") || "D") as Slot,
    venueIds: f.getAll("venueIds").map(String),
    notes: s(f, "notes"),
  };
}

const clashMsg = (c: string[]) => (c.length ? `Saved. Skipped (already booked): ${c.join(", ")}` : "");

export async function saveBlockAction(f: FormData) {
  const admin = await requireAdmin();
  const kind = s(f, "kind") as Block["kind"];
  const back = kind === "miqaat" ? "/miqaats" : "/venues";
  await run(back, async () => {
    const c = await saveBlock(admin, s(f, "id") || null, blockFrom(f, kind));
    if (c.length) throw new Error(clashMsg(c));
  });
}

export async function deleteBlockAction(f: FormData) {
  const admin = await requireAdmin();
  await run(s(f, "back"), () => deleteBlock(admin, s(f, "id")));
}

/** CSV: name,from,to,slot,venue codes (; separated),notes — dates YYYY-MM-DD, slot M/E/D. */
// shortcut: CSV only, naive comma split (no quoted commas). Excel users "Save as CSV". Upgrade: a real CSV/xlsx parser.
export async function importBlocks(f: FormData) {
  const admin = await requireAdmin();
  const kind = s(f, "kind") as Block["kind"];
  const back = kind === "miqaat" ? "/miqaats" : "/venues";
  await run(back, async () => {
    const file = f.get("file") as File;
    const venues = await getVenues();
    const lines = (await file.text()).split(/\r?\n/).slice(1).filter((l) => l.trim());
    const report: string[] = [];
    for (const [i, line] of lines.entries()) {
      const [name, from, to, slot, codes, notes = ""] = line.split(",").map((x) => x.trim());
      try {
        const venueIds = codes.split(";").map((c) => venues.find((v) => v.code === c.trim().toUpperCase())?.id).filter(Boolean) as string[];
        const c = await saveBlock(admin, null, { kind, name, from, to: to || from, slot: (slot || "D") as Slot, venueIds, notes });
        if (c.length) report.push(`row ${i + 2} ${name}: skipped ${c.join(", ")}`);
      } catch (e) {
        report.push(`row ${i + 2} ${name}: ${(e as Error).message}`);
      }
    }
    if (report.length) throw new Error(`Imported with issues — ${report.join(" | ")}`);
  });
}

// ── Admin: sectors & users ──────────────────────────────────────────────────

export async function saveSector(f: FormData) {
  const admin = await requireAdmin();
  await run("/sectors", async () => {
    const id = s(f, "id");
    const ref = id ? db.doc(`sectors/${id}`) : db.collection("sectors").doc();
    const data = { name: s(f, "name").toUpperCase(), code: s(f, "code").toUpperCase(), contactName: s(f, "contactName"), contactMobile: s(f, "contactMobile"), active: f.get("active") === "on" };
    await db.runTransaction(async (tx) => {
      tx.set(ref, data);
      audit(tx, admin, id ? "sector.update" : "sector.create", { sectorId: ref.id, ...data });
    });
  });
}

/** Firebase sends the reset email itself; for a new user it doubles as "set your password". */
async function sendPasswordEmail(email: string) {
  const base = process.env.FIREBASE_AUTH_EMULATOR_HOST ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/` : "https://";
  const res = await fetch(`${base}identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
  });
  if (!res.ok) throw new Error(`Password email failed: ${await res.text()}`);
}

export async function saveUser(f: FormData) {
  const admin = await requireAdmin();
  await run("/users", async () => {
    let uid = s(f, "id");
    const role = s(f, "role") as "admin" | "sector";
    const data = {
      name: s(f, "name"),
      mobile: mobile10(s(f, "mobile")),
      email: s(f, "email").toLowerCase(),
      role,
      sectorId: role === "admin" ? null : s(f, "sectorId"),
      active: f.get("active") === "on",
    };
    if (role === "sector" && !data.sectorId) throw new Error("Select a Sector / Mohalla");
    const authFields = { email: data.email, displayName: data.name, disabled: !data.active };
    if (uid) {
      await auth.updateUser(uid, authFields);
      if (!data.active) await auth.revokeRefreshTokens(uid); // kills existing sessions (verifySessionCookie checks revocation)
    } else {
      uid = (await auth.createUser(authFields)).uid;
      await sendPasswordEmail(data.email);
    }
    await db.runTransaction(async (tx) => {
      tx.set(db.doc(`users/${uid}`), data);
      audit(tx, admin, s(f, "id") ? "user.update" : "user.create", { uid, ...data });
    });
  });
}

export async function resetPassword(f: FormData) {
  await requireAdmin();
  await run("/users", async () => {
    await sendPasswordEmail(s(f, "email"));
    return `/users?msg=${encodeURIComponent(`Password reset email sent to ${s(f, "email")}`)}`;
  });
}
