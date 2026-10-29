export type Role = "admin" | "sector";
/** M = morning, E = evening, D = full day (both hall slots, or a room day) */
export type Slot = "M" | "E" | "D";

export type Venue = {
  id: string;
  name: string;
  code: string;
  type: "hall" | "room";
  capacity: number;
  morningTime: string;
  eveningTime: string;
  rates: { morning?: number; evening?: number; fullDay?: number; multiDay?: number; perDay?: number };
  active: boolean;
};

export type Sector = { id: string; name: string; code: string; contactName: string; contactMobile: string; active: boolean };

export type AppUser = { uid: string; name: string; mobile: string; email: string; role: Role; sectorId: string | null; active: boolean };

export type Household = { id: string; hof: string; name: string; mobile: string; address: string; sectorId: string; whatsappConsent: boolean };

export type Item = { venueId: string; venueName: string; date: string; slot: Slot; rate: number };

export type Booking = {
  id: string;
  no: string;
  sectorId: string;
  sectorName: string;
  createdBy: string;
  createdByName: string;
  household: { name: string; hof: string; mobile: string; whatsappConsent: boolean };
  items: Item[];
  event: { purpose: string; guests: number };
  amount: number;
  status: "pending" | "confirmed" | "cancelled";
  /** Pending only: after this the hold lapses and the slots count as free (lazily — no cron). */
  holdUntil: string;
  cancelRequested?: boolean;
  /** Paid after the hold lapsed and someone else took the slot. Admin refunds manually. */
  refundDue?: boolean;
  payment?: { linkId: string; url: string; paymentId?: string; method?: string; paidAt?: string };
  receiptNo?: string;
  /** Public B2 link to the receipt PDF (or the app's /r/{id}/pdf fallback). */
  receiptUrl?: string;
  createdAt: string;
};

/** One doc per venue/date/slot: its existence is the double-booking guard. */
export type Lock = {
  venueId: string;
  date: string;
  slot: Slot;
  kind: "booking" | "block";
  refId: string;
  status: "pending" | "confirmed" | "block";
  sectorId?: string;
  holdUntil?: string;
};

export type Block = {
  id: string;
  kind: "miqaat" | "maintenance";
  name: string;
  from: string;
  to: string;
  slot: Slot;
  venueIds: string[];
  notes: string;
  /** false = Miqaat recorded for information only, venues stay bookable. Missing (older docs) = true. */
  blocking?: boolean;
  lockIds: string[];
  clashes: string[];
};

export const EXPENSE_CATEGORIES = ["Electricity", "Maintenance", "Cleaning", "Repairs", "Other"];

export type Expense = {
  id: string;
  date: string;
  /** "" = All / general (not tied to one venue) */
  venueId: string;
  category: string;
  amount: number;
  paidTo: string;
  notes: string;
  billUrl?: string;
  billName?: string;
  createdBy: string;
  createdAt: string;
};

export type Cancellation = {
  id: string;
  no: string;
  bookingId: string;
  bookingNo: string;
  sectorId: string;
  reason: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: "awaiting" | "approved" | "rejected";
  adminComment?: string;
  refund?: { amount: number; date: string; mode: string; reference: string; recordedBy: string };
};
