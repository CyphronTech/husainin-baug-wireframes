"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { audit, cancelPending, createBooking, decideCancellation, deleteBlock, getBooking, markPaid, notify, requestCancellation, saveBlock } from "@/lib/booking";
import { displayStatus } from "@/lib/format";
import { readSectors as getSectors, readVenues as getVenues } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { createPaymentLink, mockPayments } from "@/lib/razorpay";
import { endSession, requireAdmin, requireUser, startSession } from "@/lib/session";
import type { AppUser, Block, Household, Slot } from "@/lib/types";

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

// ── Login ───────────────────────────────────────────────────────────────────

export async function login(f: FormData) {
  await run("/login", async () => {
    const doc = await db.doc(`users/${s(f, "username")}`).get();
    const u = doc.data();
    // shortcut: plain-text password compare, as requested for now. Anyone with Firestore console access can read
    // passwords. Upgrade: store scrypt hashes (node:crypto scryptSync + timingSafeEqual), compare here.
    if (!u || !u.active || u.password !== String(f.get("password") ?? "")) throw new Error("Wrong username or password");
    await startSession(doc.id, f.get("remember") === "on");
    return "/";
  });
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ── Bookings ────────────────────────────────────────────────────────────────

export async function bookFromWizard(f: FormData) {
  const user = await requireUser();
  const state = new URLSearchParams({ t: s(f, "t"), from: s(f, "from"), to: s(f, "to"), v: s(f, "v"), h: s(f, "h") });
  await run(`/book/review?${state}`, async () => {
    const hh = (await db.doc(`households/${s(f, "h")}`).get()).data() as Household | undefined;
    if (!hh || (user.role !== "admin" && hh.sectorId !== user.sectorId)) throw new Error("Select a household");
    const sector = (await getSectors()).find((x) => x.id === hh.sectorId)!;
    const id = await createBooking(user, {
      venueIds: s(f, "v").split(","),
      from: s(f, "from"),
      to: s(f, "to") || s(f, "from"),
      slot: (s(f, "t") === "X" ? "D" : s(f, "t")) as Slot,
      sectorId: sector.id,
      sectorName: sector.name,
      household: { name: hh.name, hof: hh.hof, mobile: hh.mobile, whatsappConsent: hh.whatsappConsent },
      event: { purpose: s(f, "purpose"), guests: n(f, "guests") ?? 0 },
    });
    await sendLink(id).catch(() => {}); // booking + hold stand even if Razorpay is down; retry from booking page
    return `/bookings/${id}`;
  });
}

/** Payment link: create once, then (re)send on WhatsApp while the hold is live. */
async function sendLink(id: string) {
  let b = (await getBooking(id))!;
  if (displayStatus(b) !== "On hold") throw new Error("Hold has expired — create a new booking");
  if (!b.payment) {
    const link = await createPaymentLink(b);
    await db.doc(`bookings/${id}`).update({ payment: { linkId: link.id, url: link.url } });
    b = { ...b, payment: { linkId: link.id, url: link.url } };
  }
  await notify(b, "hold");
}

/** Sector users may only touch their own sector's bookings, whatever id they post. */
async function scoped(id: string) {
  const user = await requireUser();
  const b = await getBooking(id);
  if (!b || (user.role !== "admin" && b.sectorId !== user.sectorId)) throw new Error("Not found");
  return user;
}

export async function resendLink(f: FormData) {
  const id = s(f, "id");
  await scoped(id);
  await run(`/bookings/${id}`, async () => {
    await sendLink(id);
    return `/bookings/${id}?msg=${encodeURIComponent("Payment link sent on WhatsApp")}`;
  });
}

export async function releaseBooking(f: FormData) {
  const id = s(f, "id");
  const user = await scoped(id);
  await run(`/bookings/${id}`, () => cancelPending(user, id));
}

export async function requestCancel(f: FormData) {
  const id = s(f, "id");
  const user = await scoped(id);
  await run(`/bookings/${id}/cancel`, async () => {
    if (f.get("informed") !== "on") throw new Error("Confirm the household has been informed about the refund policy");
    await requestCancellation(user, id, [s(f, "reason"), s(f, "details")].filter(Boolean).join(": "));
    return `/bookings/${id}/cancel`;
  });
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
    updateTag("venues");
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
    updateTag("sectors");
  });
}

/** Username is the users/{username} doc id: unique, and fixed once created. */
export async function saveUser(f: FormData) {
  const admin = await requireAdmin();
  await run("/users", async () => {
    const editing = s(f, "id");
    const username = editing || s(f, "username");
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw new Error("Username: 3–40 letters, digits, . _ -");
    const ref = db.doc(`users/${username}`);
    const role = s(f, "role") as "admin" | "sector";
    const password = String(f.get("password") ?? "");
    const data = {
      username,
      name: s(f, "name"),
      mobile: mobile10(s(f, "mobile")),
      email: s(f, "email").toLowerCase(),
      role,
      sectorId: role === "admin" ? null : s(f, "sectorId"),
      active: f.get("active") === "on",
      ...(password && { password }), // blank on edit = keep current password
    };
    if (role === "sector" && !data.sectorId) throw new Error("Select a Sector / Mohalla");
    await db.runTransaction(async (tx) => {
      const exists = (await tx.get(ref)).exists;
      if (!editing && exists) throw new Error(`Username ${username} is taken`);
      if (!editing && !password) throw new Error("Set a password");
      tx.set(ref, data, { merge: true });
      const { password: _, ...logged } = data;
      audit(tx, admin, editing ? "user.update" : "user.create", { uid: username, ...logged });
    });
  });
}

// ── Households ──────────────────────────────────────────────────────────────

type HouseholdInput = Omit<Household, "id">;

/** HOF ID is the doc id: unique across all sectors. A HOF registered to another sector is never overwritten. */
async function upsertHousehold(user: AppUser, h: HouseholdInput) {
  if (!/^\d{8,10}$/.test(h.hof)) throw new Error(`HOF ID must be 8–10 digits (${h.hof || "blank"})`);
  if (!h.name) throw new Error(`Name missing for HOF ${h.hof}`);
  if (user.role !== "admin" && h.sectorId !== user.sectorId) throw new Error("Not your Sector / Mohalla");
  h.mobile = mobile10(h.mobile);
  const ref = db.doc(`households/${h.hof}`);
  await db.runTransaction(async (tx) => {
    const existing = (await tx.get(ref)).data() as Household | undefined;
    if (existing && existing.sectorId !== h.sectorId) throw new Error(`HOF ${h.hof} belongs to another Sector / Mohalla`);
    tx.set(ref, h);
    audit(tx, user, existing ? "household.update" : "household.create", { hof: h.hof });
  });
}

const householdFrom = (user: AppUser, f: FormData): HouseholdInput => ({
  hof: s(f, "hof"),
  name: s(f, "name"),
  mobile: s(f, "mobile"),
  address: s(f, "address"),
  sectorId: user.role === "admin" ? s(f, "sectorId") : user.sectorId!,
  whatsappConsent: f.get("whatsappConsent") === "on",
});

export async function saveHousehold(f: FormData) {
  const user = await requireUser();
  const back = s(f, "back");
  await run(back ? `/households?back=${encodeURIComponent(back)}` : "/households", async () => {
    const h = householdFrom(user, f);
    await upsertHousehold(user, h);
    // Came from the booking wizard: return there with the new household selected.
    if (back.startsWith("/book/")) return `${back}${back.includes("?") ? "&" : "?"}h=${h.hof}`;
  });
}

/** Rows were parsed and previewed in the browser; everything is validated again here. */
export async function importHouseholds(f: FormData) {
  const user = await requireUser();
  await run("/households", async () => {
    const rows = JSON.parse(s(f, "rows")) as Omit<HouseholdInput, "sectorId">[];
    const sectorId = user.role === "admin" ? s(f, "sectorId") : user.sectorId!;
    if (!sectorId) throw new Error("Select a Sector / Mohalla");
    const errors: string[] = [];
    for (const r of rows) await upsertHousehold(user, { ...r, sectorId }).catch((e) => errors.push((e as Error).message));
    throw new Error(`Imported ${rows.length - errors.length} of ${rows.length} rows${errors.length ? ` — ${errors.join("; ")}` : ""}`);
  });
}
