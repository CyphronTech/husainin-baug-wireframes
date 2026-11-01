import type { DocumentReference, DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import { cartItems } from "./cart";
import { readVenues as getVenues } from "./data";
import { db } from "./firebase-admin";
import { dmy, inr, summary, today } from "./format";
import { storeReceipt } from "./receipt";
import { sendSms } from "./sms";
import { sendWhatsApp, type Template } from "./whatsapp";
import type { AppUser, Block, Booking, Cancellation, Item, Lock, Slot, Venue } from "./types";

// shortcut: one Firestore transaction holds ≤500 writes, so a single booking/block row is capped at 60 days.
// Longer ranges → split into several rows (or batch the lock writes outside the transaction).
const MAX_DAYS = 60;
export const HOLD_MINUTES = 10;

export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  if (!out.length) throw new Error("To date is before From date");
  if (out.length > MAX_DAYS) throw new Error(`Max ${MAX_DAYS} days per entry`);
  return out;
}

/** Form values arrive as strings: anything but M/E/D would make a lock no other slot checks (a double booking). */
export function assertSlot(s: string): asserts s is Slot {
  if (!["M", "E", "D"].includes(s)) throw new Error("Slot must be Morning, Evening or Full day");
}

/** Hall full day = both M and E locks, so a later M or E request clashes. Rooms only have day locks. */
export const lockSlots = (type: Venue["type"], slot: Slot): Slot[] => (type === "room" ? ["D"] : slot === "D" ? ["M", "E"] : [slot]);
export const lockRef = (venueId: string, date: string, s: Slot) => db.doc(`locks/${venueId}_${date}_${s}`);
const itemLockRefs = (items: Item[], venues: Venue[]) =>
  items.flatMap((i) => lockSlots(venues.find((v) => v.id === i.venueId)!.type, i.slot).map((s) => lockRef(i.venueId, i.date, s)));

/** A pending lock whose hold has lapsed is free. Expiry is lazy: whoever reads it next treats it as gone. */
// shortcut: lapsed locks stay in Firestore until overwritten; harmless because every reader goes through this.
// Upgrade: a scheduled function that deletes them, if storage or query cost ever matters.
export const isLive = (l: Lock | undefined, now = new Date().toISOString()) => !!l && !(l.status === "pending" && l.holdUntil! < now);
const liveSnap = (s: DocumentSnapshot) => s.exists && isLive(s.data() as Lock);

export const DEFAULT_MAX_THAAL = 100;
export const maxThaal = (v: Venue) => v.maxThaal || DEFAULT_MAX_THAAL;

/** Thaal the selected halls hold together. 0 = no limit (no halls selected). */
export function thaalLimit(venues: Venue[]) {
  return venues.filter((v) => v.type === "hall").reduce((a, v) => a + maxThaal(v), 0);
}

/** Must be called before any tx writes (Firestore: all reads first). */
async function nextNo(tx: Transaction, name: string, prefix: string, sep = "-") {
  const ref = db.doc(`counters/${name}`);
  const n = ((await tx.get(ref)).data()?.n ?? 0) + 1;
  return { no: `${prefix}${sep}${String(n).padStart(4, "0")}`, commit: () => tx.set(ref, { n }) };
}

/** Indian financial year (April–March, IST) as "26-27". */
export function financialYear(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600e3);
  const y = ist.getUTCFullYear() - (ist.getUTCMonth() < 3 ? 1 : 0);
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}

export function audit(tx: Transaction, by: Pick<AppUser, "uid" | "name"> | null, action: string, data: object) {
  tx.set(db.collection("audit").doc(), { action, data, uid: by?.uid ?? "system", by: by?.name ?? "system", at: new Date().toISOString() });
}

const describe = (l: Lock, venues: Venue[]) => `${venues.find((v) => v.id === l.venueId)?.name ?? l.venueId} ${dmy(l.date)} ${l.slot}`;

export async function createBooking(
  user: AppUser,
  input: { cart: string; sectorId: string; sectorName: string; household: Booking["household"]; event: Booking["event"] },
) {
  if (!Number.isInteger(input.event.guests) || input.event.guests < 1) throw new Error("Enter the expected guests");
  const all = await getVenues();
  const items = cartItems(input.cart, all);
  if (!items.length) throw new Error("Select at least one venue");
  const past = items.find((i) => i.date < today());
  if (past) throw new Error(`${past.venueName} ${dmy(past.date)} is in the past. Remove it from the cart`);
  const venues = all.filter((v) => items.some((i) => i.venueId === v.id));
  const capacity = venues.filter((v) => v.type === "hall").reduce((s, v) => s + v.capacity, 0);
  if (capacity && input.event.guests > capacity) throw new Error(`Expected guests exceed hall capacity of ${capacity}`);
  if (venues.some((v) => v.type === "hall")) {
    const thaal = input.event.thaal ?? 0;
    if (!Number.isInteger(thaal) || thaal < 1) throw new Error("Enter the number of thaal");
    const limit = thaalLimit(venues);
    if (limit && thaal > limit) throw new Error(`Thaal exceed the hall limit of ${limit}`);
  }
  const refs = itemLockRefs(items, venues);
  const bookingRef = db.collection("bookings").doc();
  const holdUntil = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();

  // All-or-nothing: every lock is checked and written in one transaction, so two users racing for the same slot
  // can't both win — the loser's transaction retries, sees the lock, and fails.
  await db.runTransaction(async (tx) => {
    const taken = (await tx.getAll(...refs)).filter(liveSnap);
    if (taken.length) throw new Error(`Not available: ${taken.map((s) => describe(s.data() as Lock, venues)).join(", ")}`);
    const { no, commit } = await nextNo(tx, "booking", "BK");
    commit();
    for (const ref of refs) {
      const [venueId, date, slot] = ref.id.split("_") as [string, string, Slot];
      tx.set(ref, { venueId, date, slot, kind: "booking", refId: bookingRef.id, status: "pending", sectorId: input.sectorId, holdUntil } satisfies Lock);
    }
    const booking: Omit<Booking, "id"> = {
      no,
      sectorId: input.sectorId,
      sectorName: input.sectorName,
      createdBy: user.uid,
      createdByName: user.name,
      household: input.household,
      items,
      event: input.event,
      amount: items.reduce((s, i) => s + i.rate, 0),
      status: "pending",
      holdUntil,
      createdAt: new Date().toISOString(),
    };
    tx.set(bookingRef, booking);
    audit(tx, user, "booking.create", { bookingId: bookingRef.id, no, items });
  });
  return bookingRef.id;
}

export async function getBooking(id: string) {
  const d = await db.doc(`bookings/${id}`).get();
  return d.exists ? ({ id: d.id, ...d.data() } as Booking) : null;
}

/** Called by the Razorpay webhook (and the mock checkout). Idempotent: Razorpay retries webhooks. */
export async function markPaid(linkId: string, paymentId: string, method: string) {
  const q = await db.collection("bookings").where("payment.linkId", "==", linkId).limit(1).get();
  if (q.empty) return;
  const ref = q.docs[0].ref;
  const venues = await getVenues();
  const booking = await db.runTransaction(async (tx) => {
    const b = { id: ref.id, ...(await tx.get(ref)).data() } as Booking;
    if (b.status !== "pending") return null;
    const lockRefs = itemLockRefs(b.items, venues);
    const locks = await tx.getAll(...lockRefs);
    const paidAt = new Date().toISOString();
    const pay = { "payment.paymentId": paymentId, "payment.method": method, "payment.paidAt": paidAt };
    // Paid after the hold lapsed: fine if nobody took the slots meanwhile, otherwise flag a refund.
    if (locks.some((l) => !l.exists || l.data()!.refId !== b.id)) {
      tx.update(ref, { ...pay, status: "cancelled", refundDue: true });
      audit(tx, null, "booking.paid_after_expiry", { bookingId: b.id, paymentId });
      return null;
    }
    // GST invoice number: sequential, restarts each financial year, ≤16 chars, e.g. HB/26-27/0001.
    const fy = financialYear();
    const { no, commit } = await nextNo(tx, `invoice-${fy}`, `${process.env.GST_INVOICE_PREFIX ?? "HB"}/${fy}`, "/");
    commit();
    tx.update(ref, { ...pay, status: "confirmed", receiptNo: no });
    lockRefs.forEach((l) => tx.update(l, { status: "confirmed" }));
    audit(tx, null, "booking.paid", { bookingId: b.id, paymentId, receiptNo: no });
    return { ...b, receiptNo: no };
  });
  if (!booking) return;
  const receiptUrl = await storeReceipt(booking);
  await db.doc(`bookings/${booking.id}`).update({ receiptUrl });
  await notify({ ...booking, receiptUrl }, "confirmed");
}

/** WhatsApp template values per message; the booking page renders its message previews from the same function. */
export function messageValues(b: Booking, template: Template, refund?: number) {
  const base = [b.household.name, b.no, summary(b.items), inr(b.amount)];
  if (template === "hold") return [...base, String(HOLD_MINUTES), b.payment?.url ?? ""];
  if (template === "confirmed") return [...base, b.receiptUrl ?? ""];
  return [...base.slice(0, 3), refund ? inr(refund) : "—"];
}

/** WhatsApp first; SMS when WhatsApp fails or the household hasn't consented to WhatsApp. */
// shortcut: "fails" = MSG91 rejected the send. A message accepted but never delivered isn't caught.
// Upgrade: MSG91 delivery-report webhook → send the SMS on a failed delivery status.
export async function notify(b: Booking, template: Template, refund?: number) {
  const values = messageValues(b, template, refund);
  const log = (action: string) => db.runTransaction(async (tx) => audit(tx, null, action, { bookingId: b.id, values }));
  if (b.household.whatsappConsent) {
    const ok = await sendWhatsApp(template, b.household.mobile, values);
    await log(ok ? `whatsapp.${template}` : `whatsapp.${template}.failed`);
    if (ok) return;
  }
  await log((await sendSms(template, b.household.mobile, values)) ? `sms.${template}` : `sms.${template}.failed`);
}

const canAct = (user: AppUser, b: Booking) => user.role === "admin" || b.createdBy === user.uid;

/** Unpaid hold: creator or admin releases it directly — nothing to refund, no approval needed. */
export async function cancelPending(user: AppUser, bookingId: string) {
  const venues = await getVenues();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`bookings/${bookingId}`);
    const b = { id: bookingId, ...(await tx.get(ref)).data() } as Booking;
    if (!canAct(user, b)) throw new Error("Only the user who created this booking can cancel it");
    if (b.status !== "pending") throw new Error("Only unpaid bookings can be released directly");
    // A lapsed hold's lock may already belong to a newer booking — only delete our own.
    const locks = await tx.getAll(...itemLockRefs(b.items, venues));
    locks.filter((l) => l.exists && l.data()!.refId === bookingId).forEach((l) => tx.delete(l.ref));
    tx.update(ref, { status: "cancelled" });
    audit(tx, user, "booking.release", { bookingId });
  });
}

export async function requestCancellation(user: AppUser, bookingId: string, reason: string) {
  await db.runTransaction(async (tx) => {
    const bRef = db.doc(`bookings/${bookingId}`);
    const b = { id: bookingId, ...(await tx.get(bRef)).data() } as Booking;
    if (!canAct(user, b)) throw new Error("Only the user who created this booking can cancel it");
    if (b.status !== "confirmed") throw new Error("Booking is not confirmed");
    if (b.cancelRequested) throw new Error("A cancellation request is already awaiting approval");
    const { no, commit } = await nextNo(tx, "cancellation", "CR");
    commit();
    const cr: Omit<Cancellation, "id"> = {
      no,
      bookingId,
      bookingNo: b.no,
      sectorId: b.sectorId,
      reason,
      requestedBy: user.uid,
      requestedByName: user.name,
      requestedAt: new Date().toISOString(),
      status: "awaiting",
    };
    tx.set(db.collection("cancellations").doc(), cr);
    tx.update(bRef, { cancelRequested: true });
    audit(tx, user, "cancellation.request", { bookingId, no, reason });
  });
}

/** Refunds are paid manually outside the system; this only records them. */
export async function decideCancellation(admin: AppUser, crId: string, approve: boolean, comment: string, refund?: Omit<NonNullable<Cancellation["refund"]>, "recordedBy">) {
  const venues = await getVenues();
  const crRef = db.doc(`cancellations/${crId}`);
  const booking = await db.runTransaction(async (tx) => {
    const cr = (await tx.get(crRef)).data() as Cancellation | undefined;
    if (!cr) throw new Error("Cancellation request not found");
    if (cr.status !== "awaiting") throw new Error("Already decided");
    const bRef = db.doc(`bookings/${cr.bookingId}`);
    const b = { id: bRef.id, ...(await tx.get(bRef)).data() } as Booking;
    if (approve && refund && !(refund.amount > 0 && refund.amount <= b.amount)) throw new Error(`Refund must be between ₹ 1 and the amount paid (${inr(b.amount)})`);
    tx.update(crRef, { status: approve ? "approved" : "rejected", adminComment: comment, ...(approve && refund ? { refund: { ...refund, recordedBy: admin.name } } : {}) });
    if (approve) itemLockRefs(b.items, venues).forEach((l) => tx.delete(l)); // confirmed locks are never overwritten, so these are ours
    tx.update(bRef, { cancelRequested: false, ...(approve ? { status: "cancelled" } : {}) });
    audit(tx, admin, approve ? "cancellation.approve" : "cancellation.reject", { crId, bookingId: b.id, comment, refund });
    return approve ? b : null;
  });
  if (booking) await notify(booking, "cancelled", refund?.amount);
}

/**
 * Miqaat / maintenance block. Slots already held by a booking are skipped and reported back as clashes.
 * `blocking: false` records the Miqaat without reserving venues. `dryRun` only reports clashes (import preview).
 */
export async function saveBlock(user: AppUser, id: string | null, data: Omit<Block, "id" | "lockIds" | "clashes">, dryRun = false) {
  assertSlot(data.slot);
  const venues = (await getVenues()).filter((v) => data.venueIds.includes(v.id));
  if (!venues.length) throw new Error("Select at least one venue");
  const dates = datesBetween(data.from, data.to);
  const ref = id ? db.doc(`blocks/${id}`) : db.collection("blocks").doc();
  const wanted = data.blocking === false ? [] : venues.flatMap((v) => dates.flatMap((d) => lockSlots(v.type, data.slot).map((s) => lockRef(v.id, d, s))));

  return db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    const snaps = wanted.length ? await tx.getAll(...wanted) : [];
    const isClash = (s: DocumentSnapshot) => liveSnap(s) && s.data()!.refId !== ref.id;
    const clashes = snaps.filter(isClash).map((s) => describe(s.data() as Lock, venues));
    if (dryRun) return clashes;
    const free = snaps.filter((s) => !isClash(s)).map((s) => s.ref as DocumentReference);
    const keep = new Set(free.map((r) => r.id));
    for (const lid of (old.data()?.lockIds as string[]) ?? []) if (!keep.has(lid)) tx.delete(db.doc(`locks/${lid}`));
    for (const r of free) {
      const [venueId, date, slot] = r.id.split("_") as [string, string, Slot];
      tx.set(r, { venueId, date, slot, kind: "block", refId: ref.id, status: "block" } satisfies Lock);
    }
    tx.set(ref, { ...data, lockIds: [...keep], clashes });
    audit(tx, user, id ? "block.update" : "block.create", { blockId: ref.id, ...data, clashes });
    return clashes;
  });
}

export async function deleteBlock(user: AppUser, id: string) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`blocks/${id}`);
    const b = (await tx.get(ref)).data() as Block | undefined;
    if (!b) throw new Error("Already deleted");
    b.lockIds.forEach((l) => tx.delete(db.doc(`locks/${l}`)));
    tx.delete(ref);
    audit(tx, user, "block.delete", { blockId: id, name: b.name });
  });
}
