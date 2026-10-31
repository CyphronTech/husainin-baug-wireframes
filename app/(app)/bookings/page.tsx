import Link from "next/link";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { getSectors, getVenues } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { dmy, inr, SLOT_LABEL, summary, today } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Block, Booking } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

export default async function Bookings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  // Month filter jumps to the 1st of that month; prev/next week links carry `start`.
  const start = sp.start || (sp.month ? `${sp.month}-01` : today());
  const now = new Date();
  const months = Array.from({ length: 15 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2 + i, 1)));
  const [allVenues, sectors, { days, locks }] = await Promise.all([getVenues(), getSectors(), loadWeek(start)]);
  const venues = allVenues.filter((v) => v.active && (!sp.type || v.type === sp.type) && (!sp.venue || v.id === sp.venue));

  const keep = Object.fromEntries(Object.entries({ start, type: sp.type, venue: sp.venue, sector: sp.sector }).filter(([, v]) => v)) as Record<string, string>;
  const q = (extra: Record<string, string>) => `?${new URLSearchParams({ ...keep, ...extra })}`;

  const sel = sp.sel ? locks.get(sp.sel) : undefined;
  const selRef = sel && (await db.doc(`${sel.kind === "booking" ? "bookings" : "blocks"}/${sel.refId}`).get());
  const selData = selRef?.exists ? ({ id: selRef.id, ...selRef.data() } as Booking & Block) : null;
  const canSeeHousehold = (sectorId?: string) => isAdmin || sectorId === user.sectorId;

  return (
    <>
      <div className="top"><h1>Hall or Room booking options</h1></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <h2>Filters</h2>
        <form className="row">
          <label>Venue type<select name="type" defaultValue={sp.type}><option value="">All halls &amp; rooms</option><option value="hall">Halls</option><option value="room">Rooms</option></select></label>
          <label>Month<select name="month" defaultValue={start.slice(0, 7)}>
            {!months.some((m) => m.toISOString().startsWith(start.slice(0, 7))) && <option value={start.slice(0, 7)}>{start.slice(0, 7)}</option>}
            {months.map((m) => <option key={m.toISOString()} value={m.toISOString().slice(0, 7)}>{m.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
          </select></label>
          <label>Venue<select name="venue" defaultValue={sp.venue}><option value="">All venues</option>{allVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label>Booked by<select name="sector" defaultValue={sp.sector}><option value="">All Sectors / Mohallas</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <button className="btn">Apply</button>
        </form>
      </div>

      <div className="card">
        <div className="top mb-2">
          <h2 className="m0">Availability calendar</h2>
          <span><Link prefetch={false} className="btn" href={q({ start: addDays(start, -7) })}>← Prev week</Link> <Link prefetch={false} className="btn" href={q({ start: addDays(start, 7) })}>Next week →</Link></span>
        </div>
        <Legend />
        <Calendar
          venues={venues}
          days={days}
          locks={locks}
          sel={sp.sel}
          freeHref={(v, d, s) => `/book?${new URLSearchParams({ t: s, from: d, to: d, v })}`}
          takenHref={(id) => q({ sel: id })}
          dim={(l) => !!sp.sector && l.kind === "booking" && l.sectorId !== sp.sector}
        />
        <div className="alert info">Halls book by Morning (M) or Evening (E) slot; both slots = Full day. Rooms book by full day. Click a free slot to start a booking.</div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Booking options</h2>
          <table>
            <thead><tr><th>Venue</th><th>Booking options</th></tr></thead>
            <tbody>
              <tr><td>Halls</td><td>Morning, Evening, Full day, Multiple days</td></tr>
              <tr><td>Rooms</td><td>Full day, Multiple days</td></tr>
              <tr><td>Large gatherings</td><td>Several halls and rooms in one booking (all or nothing)</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Selected slot</h2>
          {!selData && <p className="muted">Click a booked or blocked slot in the calendar.</p>}
          {selData && sel!.kind === "block" && (
            <p><b>{selData.name}</b> · {dmy(selData.from)}{selData.to !== selData.from && ` to ${dmy(selData.to)}`} · {SLOT_LABEL[selData.slot]}<br /><span className="muted">{selData.kind === "miqaat" ? "Miqaat" : "Unavailable"} {selData.notes}</span></p>
          )}
          {selData && sel!.kind === "booking" && (
            <div className="stack">
              <p className="m0">
                <b>{summary(selData.items)}</b><br />
                Booking {selData.no}{canSeeHousehold(selData.sectorId) && ` · ${selData.household.name} (HOF ${selData.household.hof})`}<br />
                Booked by {selData.sectorName}{selData.status === "confirmed" && ` · ${inr(selData.amount)} paid`}
              </p>
              <div><Badge s={selData.status === "pending" ? "On hold" : selData.status} /></div>
              <div className="row">
                {canSeeHousehold(selData.sectorId) && <Link className="btn" href={`/bookings/${selData.id}`}>View booking</Link>}
                <Link className="btn primary" href="/book">Book another slot</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
