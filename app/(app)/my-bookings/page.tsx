import Link from "next/link";
import { resendLink } from "@/app/actions";
import { getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { displayStatus, dmy, inr, SLOT_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Booking } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

const STATUSES = ["On hold", "Confirmed", "Cancellation requested", "Cancelled", "Completed", "Expired", "Refund due"];

export default async function MyBookings({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "admin";
  const sectorId = isAdmin ? sp.sector : user.sectorId!;
  // shortcut: equality filter + in-memory filter/sort (no composite indexes); fine to a few thousand bookings per sector.
  const all = rows<Booking>(await (sectorId ? db.collection("bookings").where("sectorId", "==", sectorId) : db.collection("bookings")).get());
  const sectors = isAdmin ? await getSectors() : [];
  const term = (sp.q ?? "").toLowerCase();
  const list = all
    .map((b) => ({ ...b, shown: displayStatus(b) }))
    .filter((b) => {
      const first = b.items[0].date, last = b.items.at(-1)!.date;
      return (
        (!sp.status || b.shown === sp.status) &&
        (!sp.from || last >= sp.from) &&
        (!sp.to || first <= sp.to) &&
        (!term || `${b.no} ${b.household.name} ${b.household.hof} ${b.items.map((i) => i.venueName).join(" ")}`.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => b.items[0].date.localeCompare(a.items[0].date));

  return (
    <>
      <div className="top"><h1>List of bookings</h1></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <form className="row">
          <label>Search<input name="q" defaultValue={sp.q} placeholder="Booking, household, HOF, venue" /></label>
          <label>From date<input type="date" name="from" defaultValue={sp.from} /></label>
          <label>To date<input type="date" name="to" defaultValue={sp.to} /></label>
          <label>Status<select name="status" defaultValue={sp.status}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          {isAdmin && <label>Sector / Mohalla<select name="sector" defaultValue={sp.sector}><option value="">All</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          <button className="btn">Apply</button>
        </form>
      </div>
      <div className="card">
        <h2>Bookings ({list.length})</h2>
        <table>
          <thead><tr><th>Booking</th><th>Household</th><th>Venue(s)</th><th>Date(s)</th><th>Slot</th><th>Amount</th><th>Status</th><th>Created by</th><th /></tr></thead>
          <tbody>
            {list.map((b) => {
              const dates = [...new Set(b.items.map((i) => i.date))];
              const mine = b.createdBy === user.uid;
              return (
                <tr key={b.id}>
                  <td><Link href={`/bookings/${b.id}`}>{b.no}</Link></td>
                  <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                  <td>{[...new Set(b.items.map((i) => i.venueName))].join(" + ")}</td>
                  <td>{dates.length > 1 ? `${dmy(dates[0])} – ${dmy(dates.at(-1))}` : dmy(dates[0])}</td>
                  <td>{SLOT_LABEL[b.items[0].slot]}{dates.length > 1 && ` × ${dates.length}`}</td>
                  <td>{b.shown === "Expired" ? "—" : inr(b.amount)}</td>
                  <td><Badge s={b.shown} /></td>
                  <td>{mine ? "You" : b.createdByName}</td>
                  <td>
                    {b.receiptNo && <a href={b.receiptUrl ?? `/r/${b.id}/pdf`}>Receipt</a>}{" "}
                    {b.shown === "On hold" && <form className="inline" action={resendLink}><input type="hidden" name="id" value={b.id} /><button className="link">Resend link</button></form>}{" "}
                    {b.shown === "Confirmed" && (mine || isAdmin) && <Link href={`/bookings/${b.id}/cancel`}>Request cancellation</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="alert info">You can request cancellation only for bookings you created.</p>
      </div>
    </>
  );
}
