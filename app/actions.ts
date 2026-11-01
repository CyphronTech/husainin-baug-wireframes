"use server";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, cancelPending, createBooking, decideCancellation, deleteBlock, getBooking, markPaid, notify, requestCancellation, saveBlock } from "@/lib/booking";
import { displayStatus } from "@/lib/format";
import { getSectors, getVenues, invalidate } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { b2Enabled, uploadPublic } from "@/lib/b2";
import { createPaymentLink, mockPayments } from "@/lib/razorpay";
import { endSession, requireAdmin, requireUser, startSession } from "@/lib/session";
import { EXPENSE_CATEGORIES, type AppUser, type Block, type Household, type Slot } from "@/lib/types";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => (s(f, k) === "" ? undefined : Number(s(f, k)));
const mobile10 = (m: string) => {
  const d = m.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) throw new Error("Mobile must be 10 digits");
  return d;
};
const HOF = /^\d{8,10}$/;
const USERNAME = /^[A-Za-z0-9._-]{3,40}$/;
/** Run, then redirect back with ?msg= on failure. redirect() throws, so it must stay outside try. */
async function run(back: string, fn: () => Promise<string | void>) {
  let to = back;
  try {
    to = (await fn()) || back;
  } catch (e) {
    // Firestore/gRPC errors carry a `code` and internal paths: log them, show a plain message instead.
    const internal = (e as { code?: unknown }).code !== undefined;
    if (internal) console.error(e);
    const msg = internal ? "Something went wrong. Please try again." : (e as Error).message;
    to = `${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`;
  }
  redirect(to);
}

// ── Login ───────────────────────────────────────────────────────────────────

/** Stored as scrypt$salt$hash. Older plain-text passwords still sign in once and are re-saved hashed. */
const hashPassword = (p: string) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(p, salt, 64).toString("hex")}`;
};
function checkPassword(stored: string, p: string) {
  if (!stored.startsWith("scrypt$")) return stored !== "" && stored === p;
  const [, salt, hash] = stored.split("$");
  const want = Buffer.from(hash ?? "", "hex");
  return want.length === 64 && timingSafeEqual(scryptSync(p, salt, 64), want);
}

// shortcut: failed-login counter lives in this process (fine with maxInstances: 1). More instances → keep it in Firestore.
const failed = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 5;

export async function login(f: FormData) {
  await run("/login", async () => {
    const username = s(f, "username");
    const password = String(f.get("password") ?? "");
    const prev = failed.get(username);
    const live = prev && prev.until > Date.now() ? prev : undefined;
    if (live && live.n >= MAX_FAILS) throw new Error("Too many attempts. Try again in 15 minutes");
    const u = USERNAME.test(username) ? (await db.doc(`users/${username}`).get()).data() : undefined;
    if (!u || !u.active || !checkPassword(String(u.password ?? ""), password)) {
      if (failed.size > 10_000) failed.clear(); // stay bounded under a flood of made-up usernames
      failed.set(username, { n: (live?.n ?? 0) + 1, until: Date.now() + 15 * 60_000 });
      throw new Error("Wrong username or password");
    }
    failed.delete(username);
    if (!String(u.password).startsWith("scrypt$")) await db.doc(`users/${username}`).update({ password: hashPassword(password) });
    await startSession(username, f.get("remember") === "on");
    return "/";
  });
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/** Header toggle: Misri (default) or English dates, saved per user. */
export async function setCalendar(fd: FormData) {
  const user = await requireUser();
  await db.doc(`users/${user.uid}`).update({ cal: fd.get("cal") === "en" ? "en" : "hijri" });
  revalidatePath("/", "layout"); // every page shows dates
}

// ── Bookings ────────────────────────────────────────────────────────────────

export async function bookFromWizard(f: FormData) {
  const user = await requireUser();
  const state = new URLSearchParams({ c: s(f, "c"), from: s(f, "from"), to: s(f, "to"), th: s(f, "thaal"), h: s(f, "h") });
  await run(`/book/review?${state}`, async () => {
    if (!HOF.test(s(f, "h"))) throw new Error("Select a household");
    const hh = (await db.doc(`households/${s(f, "h")}`).get()).data() as Household | undefined;
    if (!hh || (user.role !== "admin" && hh.sectorId !== user.sectorId)) throw new Error("Select a household");
    const sector = (await getSectors()).find((x) => x.id === hh.sectorId)!;
    const id = await createBooking(user, {
      cart: s(f, "c"), // validated in createBooking
      sectorId: sector.id,
      sectorName: sector.name,
      household: { name: hh.name, hof: hh.hof, mobile: hh.mobile, whatsappConsent: hh.whatsappConsent },
      event: { purpose: s(f, "purpose"), guests: n(f, "guests") ?? 0, thaal: n(f, "thaal") ?? 0 },
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
  await requireUser();
  const linkId = s(f, "linkId");
  const found = await db.collection("bookings").where("payment.linkId", "==", linkId).limit(1).get();
  if (found.empty) throw new Error("Not found");
  await scoped(found.docs[0].id); // sector users pay only their own sector's bookings
  await markPaid(linkId, `pay_mock_${Date.now()}`, s(f, "method"));
  redirect(`/r/${found.docs[0].id}`);
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
      maxThaal: n(f, "maxThaal") ?? 0,
      morningTime: s(f, "morningTime"),
      eveningTime: s(f, "eveningTime"),
      rates: JSON.parse(JSON.stringify(rates)), // drop undefined (Firestore rejects it)
      active: f.get("active") === "on",
    };
    if (!data.name || !data.code) throw new Error("Enter the name and code");
    if (type !== "hall" && type !== "room") throw new Error("Pick hall or room");
    const bad = (x: unknown) => typeof x !== "number" || !Number.isFinite(x) || x < 0;
    if (bad(data.capacity) || bad(data.maxThaal) || Object.values(data.rates).some(bad)) throw new Error("Capacity, max thaal and rates must be 0 or more");
    if ((await getVenues()).some((v) => v.code === data.code && v.id !== id)) throw new Error(`Code ${data.code} is already used`);
    const ref = id ? db.doc(`venues/${id}`) : db.collection("venues").doc();
    // Bookings snapshot their rate per item at creation, so changing rates here never touches existing bookings.
    await db.runTransaction(async (tx) => {
      const before = (await tx.get(ref)).data();
      tx.set(ref, data);
      audit(tx, admin, id ? "venue.update" : "venue.create", { venueId: ref.id, before: before?.rates ?? null, after: data.rates });
    });
    invalidate("venues");
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
    blocking: kind === "maintenance" || f.get("blocking") === "on",
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
  await run(s(f, "back") === "/venues" ? "/venues" : "/miqaats", () => deleteBlock(admin, s(f, "id"))); // never redirect to a posted URL
}

/** One spreadsheet row: name, from, to, slot (M/E/D), venue codes (; separated), notes. Dates YYYY-MM-DD. */
export type BlockRow = { name: string; from: string; to: string; slot: string; codes: string; notes: string };

async function rowToBlock(kind: Block["kind"], r: BlockRow) {
  const venues = await getVenues();
  const codes = r.codes.split(";").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const unknown = codes.filter((c) => !venues.some((v) => v.code === c));
  if (!r.name) throw new Error("name missing");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from) || (r.to && !/^\d{4}-\d{2}-\d{2}$/.test(r.to))) throw new Error("dates must be YYYY-MM-DD");
  if (unknown.length) throw new Error(`unknown venue code ${unknown.join(", ")}`);
  if (r.slot && !["M", "E", "D"].includes(r.slot.toUpperCase())) throw new Error("slot must be M, E or D");
  const venueIds = codes.map((c) => venues.find((v) => v.code === c)!.id);
  return { kind, name: r.name, from: r.from, to: r.to || r.from, slot: (r.slot.toUpperCase() || "D") as Slot, venueIds, notes: r.notes, blocking: true };
}

/** Import preview: validates each row and checks clashes without writing anything. */
export async function previewBlocks(kind: Block["kind"], rows: BlockRow[]) {
  const admin = await requireAdmin();
  return Promise.all(
    rows.map(async (r) => {
      try {
        const clashes = await saveBlock(admin, null, await rowToBlock(kind, r), true);
        return clashes.length ? `Clash: ${clashes.join(", ")}` : "OK";
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    }),
  );
}

/** Imports the rows the preview passed. Clashes are re-checked inside each transaction (someone may have booked since). */
export async function importBlocks(f: FormData) {
  const admin = await requireAdmin();
  const kind = s(f, "kind") as Block["kind"];
  await run(kind === "miqaat" ? "/miqaats" : "/venues", async () => {
    const rows = JSON.parse(s(f, "rows")) as BlockRow[];
    const report: string[] = [];
    for (const r of rows) {
      try {
        const c = await saveBlock(admin, null, await rowToBlock(kind, r));
        if (c.length) report.push(`${r.name}: skipped ${c.join(", ")}`);
      } catch (e) {
        report.push(`${r.name}: ${(e as Error).message}`);
      }
    }
    throw new Error(`Imported ${rows.length - report.length} of ${rows.length} rows${report.length ? ` — ${report.join(" | ")}` : ""}`);
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
    invalidate("sectors");
  });
}

/** Username is the users/{username} doc id: unique, and fixed once created. */
export async function saveUser(f: FormData) {
  const admin = await requireAdmin();
  await run("/users", async () => {
    const editing = s(f, "id");
    const username = editing || s(f, "username");
    if (!USERNAME.test(username)) throw new Error("Username: 3–40 letters, digits, . _ -");
    const ref = db.doc(`users/${username}`);
    const role = s(f, "role") as "admin" | "sector";
    if (role !== "admin" && role !== "sector") throw new Error("Pick a role");
    const password = String(f.get("password") ?? "");
    const data = {
      username,
      name: s(f, "name"),
      mobile: mobile10(s(f, "mobile")),
      email: s(f, "email").toLowerCase(),
      role,
      sectorId: role === "admin" ? null : s(f, "sectorId"),
      active: f.get("active") === "on",
      ...(password && { password: hashPassword(password) }), // blank on edit = keep current password
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
  if (!HOF.test(h.hof)) throw new Error(`HOF ID must be 8–10 digits (${h.hof || "blank"})`);
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
    // Copy known fields only: the posted JSON could carry extra keys that would otherwise be stored.
    const pick = (r: Record<string, unknown>) => ({ hof: String(r.hof ?? ""), name: String(r.name ?? ""), mobile: String(r.mobile ?? ""), address: String(r.address ?? ""), whatsappConsent: r.whatsappConsent === true });
    for (const r of rows) await upsertHousehold(user, { ...pick(r), sectorId }).catch((e) => errors.push((e as Error).message));
    throw new Error(`Imported ${rows.length - errors.length} of ${rows.length} rows${errors.length ? ` — ${errors.join("; ")}` : ""}`);
  });
}

// ── Admin: expenses ─────────────────────────────────────────────────────────

/** Create, or update when `id` is posted. On update the existing bill stays unless a new one is uploaded. */
export async function saveExpense(f: FormData) {
  const admin = await requireAdmin();
  const id = s(f, "id");
  await run(`/expenses?month=${s(f, "date")}`, async () => {
    const amount = n(f, "amount");
    if (!amount || amount <= 0) throw new Error("Enter the amount");
    if (!EXPENSE_CATEGORIES.includes(s(f, "category"))) throw new Error("Pick a category");
    const ref = id ? db.doc(`expenses/${id}`) : db.collection("expenses").doc();
    const bill = f.get("bill") as File | null;
    let billUrl: string | undefined;
    if (bill && bill.size) {
      if (!b2Enabled()) throw new Error("Bill upload needs the B2 keys in .env.local");
      // shortcut: same public B2 bucket as receipts; the path holds the random expense id, so it can't be guessed.
      billUrl = await uploadPublic(`bills/${ref.id}/${bill.name.replace(/[^\w.-]+/g, "_")}`, Buffer.from(await bill.arrayBuffer()), bill.type || "application/octet-stream");
    }
    const data = {
      date: s(f, "date"),
      venueId: s(f, "venueId"),
      category: s(f, "category"),
      amount,
      paidTo: s(f, "paidTo"),
      notes: s(f, "notes"),
      ...(billUrl && { billUrl, billName: bill!.name }),
      ...(id ? { updatedBy: admin.uid, updatedAt: new Date().toISOString() } : { createdBy: admin.uid, createdAt: new Date().toISOString() }),
    };
    await db.runTransaction(async (tx) => {
      if (id && !(await tx.get(ref)).exists) throw new Error("Expense not found");
      tx.set(ref, data, { merge: true });
      audit(tx, admin, id ? "expense.update" : "expense.create", { expenseId: ref.id, ...data });
    });
  });
}

// shortcut: the uploaded bill file stays in B2 after delete (only the record goes). Upgrade: b2_delete_file_version.
export async function deleteExpense(f: FormData) {
  const admin = await requireAdmin();
  await run(`/expenses?month=${s(f, "month")}`, async () => {
    const ref = db.doc(`expenses/${s(f, "id")}`);
    await db.runTransaction(async (tx) => {
      const e = (await tx.get(ref)).data();
      if (!e) throw new Error("Expense not found");
      tx.delete(ref);
      audit(tx, admin, "expense.delete", { expenseId: ref.id, ...e }); // audit keeps the full record
    });
  });
}
