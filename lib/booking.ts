import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { getVenues } from "./data";
import { db } from "./firebase-admin";
import { dmy, inr, summary } from "./format";
import { sendWhatsApp } from "./whatsapp";
import type { AppUser, Block, Booking, Cancellation, Item, Lock, Slot, Venue } from "./types";

// shortcut: one Firestore transaction holds ≤500 writes, so a single booking/block row is capped at 60 days.
// Longer ranges → split into several rows (or batch the lock writes outside the transaction).
const MAX_DAYS = 60;

export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  if (!out.length) throw new Error("To date is before From date");
  if (out.length > MAX_DAYS) throw new Error(`Max ${MAX_DAYS} days per entry`);
  return out;
}

/** Hall full day = both M and E locks, so a later M or E request clashes. Rooms only have day locks. */
export const lockSlots = (type: Venue["type"], slot: Slot): Slot[] => (type === "room" ? ["D"] : slot === "D" ? ["M", "E"] : [slot]);
export const lockRef = (venueId: string, date: string, s: Slot) => db.doc(`locks/${venueId}_${date}_${s}`);
const itemLockRefs = (items: Item[], venues: Venue[]) =>
  items.flatMap((i) => lockSlots(venues.find((v) => v.id === i.venueId)!.type, i.slot).map((s) => lockRef(i.venueId, i.date, s)));

function rateFor(v: Venue, slot: Slot, multiDay: boolean) {
  const r = v.rates;
  const rate = v.type === "room" ? r.perDay : slot === "M" ? r.morning : slot === "E" ? r.evening : multiDay && r.multiDay ? r.multiDay : r.fullDay;
  if (rate == null) throw new Error(`No rate set for ${v.name}`);
  return rate;
}

/** Must be called before any tx writes (Firestore: all reads first). */
async function nextNo(tx: Transaction, name: string, prefix: string) {
  const ref = db.doc(`counters/${name}`);
  const n = ((await tx.get(ref)).data()?.n ?? 0) + 1;
  return { no: `${prefix}-${String(n).padStart(4, "0")}`, commit: () => tx.set(ref, { n }) };
}

export function audit(tx: Transaction, by: Pick<AppUser, "uid" | "name"> | null, action: string, data: object) {
  tx.set(db.collection("audit").doc(), { action, data, uid: by?.uid ?? "system", by: by?.name ?? "system", at: new Date().toISOString() });
}

const describe = (l: Lock, venues: Venue[]) => `${venues.find((v) => v.id === l.venueId)?.name ?? l.venueId} ${dmy(l.date)} ${l.slot}`;

export async function createBooking(
  user: AppUser,
  input: { venueIds: string[]; from: string; to: string; slot: Slot; sectorId: string; sectorName: string; household: Booking["household"] },
) {
  const venues = (await getVenues()).filter((v) => v.active && input.venueIds.includes(v.id));
  if (!venues.length) throw new Error("Select at least one venue");
  const dates = datesBetween(input.from, input.to);
  const items: Item[] = venues.flatMap((v) =>
    dates.map((date) => {
      const slot: Slot = v.type === "room" ? "D" : input.slot;
      return { venueId: v.id, venueName: v.name, date, slot, rate: rateFor(v, slot, dates.length > 1) };
    }),
  );
  const refs = itemLockRefs(items, venues);
  const bookingRef = db.collection("bookings").doc();

  // All-or-nothing: every lock is checked and created in one transaction, so two users racing for the same slot
  // can't both win — the loser's transaction retries, sees the lock, and fails.
  await db.runTransaction(async (tx) => {
    const taken = (await tx.getAll(...refs)).filter((s) => s.exists);
    if (taken.length) throw new Error(`Not available: ${taken.map((s) => describe(s.data() as Lock, venues)).join(", ")}`);
    const { no, commit } = await nextNo(tx, "booking", "BK");
    commit();
    for (const ref of refs) {
      const [venueId, date, slot] = ref.id.split("_") as [string, string, Slot];
      tx.create(ref, { venueId, date, slot, kind: "booking", refId: bookingRef.id, status: "pending", sectorId: input.sectorId } satisfies Lock);
    }
    const booking: Omit<Booking, "id"> = {
      no,
      sectorId: input.sectorId,
      sectorName: input.sectorName,
      createdBy: user.uid,
      createdByName: user.name,
      household: input.household,
      items,
      amount: items.reduce((s, i) => s + i.rate, 0),
      status: "pending",
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
    const { no, commit } = await nextNo(tx, "receipt", "RCPT");
    commit();
    const paidAt = new Date().toISOString();
    tx.update(ref, { status: "confirmed", receiptNo: no, "payment.paymentId": paymentId, "payment.method": method, "payment.paidAt": paidAt });
    for (const l of itemLockRefs(b.items, venues)) tx.update(l, { status: "confirmed" });
    audit(tx, null, "booking.paid", { bookingId: b.id, paymentId, receiptNo: no });
    return { ...b, receiptNo: no };
  });
  if (booking) await notify(booking, "confirmed", [booking.household.name, booking.no, summary(booking.items), inr(booking.amount), `${process.env.APP_URL}/r/${booking.id}`]);
}

async function notify(b: Booking, template: "confirmed" | "cancelled", values: string[]) {
  const ok = await sendWhatsApp(template, b.household.mobile, values);
  await db.runTransaction(async (tx) => audit(tx, null, ok ? `whatsapp.${template}` : `whatsapp.${template}.failed`, { bookingId: b.id }));
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
    itemLockRefs(b.items, venues).forEach((l) => tx.delete(l));
    tx.update(ref, { status: "cancelled" });
    audit(tx, user, "booking.release", { bookingId });
  });
}

export async function requestCancellation(user: AppUser, bookingId: string, reason: string) {
  await db.runTransaction(async (tx) => {
    const b = { id: bookingId, ...(await tx.get(db.doc(`bookings/${bookingId}`))).data() } as Booking;
    if (!canAct(user, b)) throw new Error("Only the user who created this booking can cancel it");
    if (b.status !== "confirmed") throw new Error("Booking is not confirmed");
    const open = await tx.get(db.collection("cancellations").where("bookingId", "==", bookingId).where("status", "==", "awaiting"));
    if (!open.empty) throw new Error("A cancellation request is already awaiting approval");
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
    audit(tx, user, "cancellation.request", { bookingId, no, reason });
  });
}

/** Refunds are paid manually outside the system; this only records them. */
export async function decideCancellation(admin: AppUser, crId: string, approve: boolean, comment: string, refund?: Omit<NonNullable<Cancellation["refund"]>, "recordedBy">) {
  const venues = await getVenues();
  const crRef = db.doc(`cancellations/${crId}`);
  const booking = await db.runTransaction(async (tx) => {
    const cr = (await tx.get(crRef)).data() as Cancellation;
    if (cr.status !== "awaiting") throw new Error("Already decided");
    const bRef = db.doc(`bookings/${cr.bookingId}`);
    const b = { id: bRef.id, ...(await tx.get(bRef)).data() } as Booking;
    tx.update(crRef, { status: approve ? "approved" : "rejected", adminComment: comment, ...(approve && refund ? { refund: { ...refund, recordedBy: admin.name } } : {}) });
    if (approve) {
      itemLockRefs(b.items, venues).forEach((l) => tx.delete(l));
      tx.update(bRef, { status: "cancelled" });
    }
    audit(tx, admin, approve ? "cancellation.approve" : "cancellation.reject", { crId, bookingId: b.id, comment, refund });
    return approve ? b : null;
  });
  if (booking) await notify(booking, "cancelled", [booking.household.name, booking.no, summary(booking.items), refund?.amount ? inr(refund.amount) : "—"]);
}

/** Miqaat / maintenance block. Slots already held by a booking are skipped and reported back as clashes. */
export async function saveBlock(user: AppUser, id: string | null, data: Omit<Block, "id" | "lockIds" | "clashes">) {
  const venues = (await getVenues()).filter((v) => data.venueIds.includes(v.id));
  if (!venues.length) throw new Error("Select at least one venue");
  const dates = datesBetween(data.from, data.to);
  const ref = id ? db.doc(`blocks/${id}`) : db.collection("blocks").doc();
  const wanted = venues.flatMap((v) => dates.flatMap((d) => lockSlots(v.type, data.slot).map((s) => lockRef(v.id, d, s))));

  return db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    const snaps = await tx.getAll(...wanted);
    const clashes = snaps.filter((s) => s.exists && s.data()!.refId !== ref.id).map((s) => describe(s.data() as Lock, venues));
    const free = snaps.filter((s) => !s.exists || s.data()!.refId === ref.id).map((s) => s.ref as DocumentReference);
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
    const b = (await tx.get(ref)).data() as Block;
    b.lockIds.forEach((l) => tx.delete(db.doc(`locks/${l}`)));
    tx.delete(ref);
    audit(tx, user, "block.delete", { blockId: id, name: b.name });
  });
}
