import { paymentRows } from "@/lib/payments";
import { getUser } from "@/lib/session";

// shortcut: CSV, which Excel opens directly. Upgrade to real .xlsx only if formatting is required.
export async function GET(req: Request) {
  if ((await getUser())?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const { list } = await paymentRows(Object.fromEntries(new URL(req.url).searchParams));
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Receipt", "Booking", "Household", "HOF", "Sector", "Amount", "Method", "Razorpay ref", "Paid on", "Status"],
    ...list.map((b) => [b.receiptNo, b.no, b.household.name, b.household.hof, b.sectorName, b.amount, b.payment?.method, b.payment?.paymentId ?? b.payment?.linkId, b.payment?.paidAt, b.payStatus]),
  ].map((r) => r.map(esc).join(","));
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payments.csv"` },
  });
}
