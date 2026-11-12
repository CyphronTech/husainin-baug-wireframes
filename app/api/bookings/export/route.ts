import writeXlsxFile from "write-excel-file/node";
import { bookingRows } from "@/lib/booking-rows";
import { dmy, SLOT_LABEL } from "@/lib/format";
import { getUser } from "@/lib/session";

/** The bookings list as Excel, with the same filters as the page. Sector users get their own sector only (bookingRows scopes it). */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { list } = await bookingRows(user, Object.fromEntries(new URL(req.url).searchParams));
  const head = ["Booking", "Household", "HOF", "Mobile", "Sector / Mohalla", "Halls & rooms", "First date", "Last date", "Function", "Thaal", "Guests", "Amount (₹)", "Status", "Receipt", "Created by", "Created on"];
  const xlsx = await writeXlsxFile([
    head.map((value) => ({ value, fontWeight: "bold" as const })),
    ...list.map((b) => [
      b.no,
      b.household.name,
      b.household.hof,
      b.household.mobile,
      b.sectorName,
      b.items.map((i) => `${i.venueName} ${dmy(i.date)} ${SLOT_LABEL[i.slot]}`).join("; "),
      new Date(`${b.items[0].date}T00:00:00Z`),
      new Date(`${b.items.at(-1)!.date}T00:00:00Z`),
      b.days?.length ? b.days.map((d) => `${dmy(d.date)}: ${d.purpose}`).join("; ") : b.event?.purpose ?? "",
      b.event?.thaal || "",
      b.event?.guests || "",
      b.amount,
      b.shown,
      b.receiptNo ?? "",
      b.createdByName,
      new Date(b.createdAt),
    ].map((value) => (value instanceof Date ? { value, format: "dd-mm-yyyy" } : { value }))),
  ]).toBuffer();
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bookings.xlsx"`,
    },
  });
}
