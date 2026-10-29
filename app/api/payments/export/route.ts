import writeXlsxFile from "write-excel-file/node";
import { paymentRows } from "@/lib/payments";
import { getUser } from "@/lib/session";

export async function GET(req: Request) {
  if ((await getUser())?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const { list } = await paymentRows(Object.fromEntries(new URL(req.url).searchParams));
  const head = ["Receipt", "Booking", "Household", "HOF", "Sector / Mohalla", "Amount (₹)", "Method", "Razorpay ref", "Paid on", "Status"];
  const xlsx = await writeXlsxFile([
    head.map((value) => ({ value, fontWeight: "bold" as const })),
    ...list.map((b) => [
      b.receiptNo ?? "",
      b.no,
      b.household.name,
      b.household.hof,
      b.sectorName,
      b.amount,
      b.payment?.method ?? "",
      b.payment?.paymentId ?? b.payment?.linkId ?? "",
      b.payment?.paidAt ? new Date(b.payment.paidAt) : "",
      b.payStatus,
    ].map((value) => (value instanceof Date ? { value, format: "dd-mm-yyyy hh:mm" } : { value }))),
  ]).toBuffer();
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payments.xlsx"`,
    },
  });
}
