import { Icon } from "@/lib/icons";
import Link from "next/link";
import { Select } from "@/lib/dropdown";
import { resendLink } from "@/app/actions";
import { DateField } from "@/lib/date-field";
import { getSectors } from "@/lib/data";
import { FilterFold } from "@/lib/switch";
import { bookingRows } from "@/lib/booking-rows";
import { fmt, inr, slotSummary } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Badge, Msg, type SP } from "@/lib/ui";

const STATUSES = ["On hold", "Confirmed", "Cancellation requested", "Cancelled", "Completed", "Expired", "Refund due"];
const PAGE_SIZE = 25;

export default async function MyBookings({ searchParams }: { searchParams: SP }) {
  const { dmy, hijri } = await fmt();
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "admin";
  const [{ list, requests }, sectors] = await Promise.all([bookingRows(user, sp), isAdmin ? getSectors() : []]);
  const exportQ = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && ["q", "from", "to", "status", "sector"].includes(e[0])));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(sp.page ?? "") || 1), pages);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(sp as Record<string, string>);
    q.delete("msg");
    q.set("page", String(n));
    return `/my-bookings?${q}`;
  };

  return (
    <>
      <div className="top"><h1>List of bookings</h1><a className="btn btn-icon" href={`/api/bookings/export?${exportQ}`} download><Icon name="download" />Export to Excel</a></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <form className="row">
          <label>Search<input name="q" defaultValue={sp.q} placeholder="Booking, household, HOF, venue" /></label>
          <FilterFold id="booking-filters" count={["from", "to", "status", "sector"].filter((k) => sp[k]).length}>
            <label>From date<DateField hijri={hijri} name="from" defaultValue={sp.from} /></label>
            <label>To date<DateField hijri={hijri} name="to" defaultValue={sp.to} /></label>
            <Select label="Status" name="status" defaultValue={sp.status}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
            {isAdmin && <Select label="Sector / Mohalla" name="sector" defaultValue={sp.sector}><option value="">All</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
          </FilterFold>
          <button className="btn btn-icon"><Icon name="filter" />Apply</button>
        </form>
      </div>
      <div className="card">
        <h2>Bookings ({list.length})</h2>
        <table>
          <thead><tr><th>Booking</th><th>Household</th><th>Venue(s)</th><th>Date(s)</th><th>Slot</th><th>Amount</th><th>Status</th><th>Created by</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((b) => {
              const dates = [...new Set(b.items.map((i) => i.date))];
              const mine = b.createdBy === user.uid;
              const crs = requests.filter((c) => c.bookingId === b.id);
              return (
                <tr key={b.id}>
                  <td><Link href={`/bookings/${b.id}`}>{b.no}</Link></td>
                  <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                  <td>{[...new Set(b.items.map((i) => i.venueName))].join(" + ")}</td>
                  <td>{dates.length > 1 ? `${dmy(dates[0])} – ${dmy(dates.at(-1))}` : dmy(dates[0])}</td>
                  <td>{slotSummary(b.items)}</td>
                  <td>{b.shown === "Expired" ? "—" : inr(b.amount)}</td>
                  <td>
                    <Badge s={b.shown} />
                    {crs.map((c) => (
                      <div key={c.id} className="muted">{c.no}: {c.status === "awaiting" ? "Awaiting approval" : c.status} · by {c.requestedByName}{c.adminComment && ` — Admin: ${c.adminComment}`}</div>
                    ))}
                  </td>
                  <td>{mine ? "You" : b.createdByName}</td>
                  <td>
                    {b.receiptNo && <a href={b.receiptUrl ?? `/r/${b.id}/pdf`}>Receipt</a>}{" "}
                    {b.shown === "On hold" && <form className="inline" action={resendLink}><input type="hidden" name="id" value={b.id} /><button className="link btn-icon"><Icon name="send" size={16} />Resend link</button></form>}{" "}
                    {b.shown === "Confirmed" && (mine || isAdmin) && <Link href={`/bookings/${b.id}/cancel`}>Request cancellation</Link>}{" "}
                    {isAdmin && crs.some((c) => c.status === "awaiting") && <Link href={`/bookings/${b.id}/cancel`}>Review</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pages > 1 && (
          <nav className="row items-center justify-end mt-3" aria-label="Pagination">
            {page > 1 ? <Link className="btn btn-icon" href={pageHref(page - 1)}><Icon name="back" />Previous</Link> : <button className="btn btn-icon" disabled><Icon name="back" />Previous</button>}
            <span className="muted">Page {page} of {pages}</span>
            {page < pages ? <Link className="btn btn-icon" href={pageHref(page + 1)}>Next<Icon name="next" /></Link> : <button className="btn btn-icon" disabled>Next<Icon name="next" /></button>}
          </nav>
        )}
        <p className="alert info">You can request cancellation only for bookings you created.</p>
      </div>
    </>
  );
}
