import Link from "next/link";
import { newBooking } from "@/app/actions";
import { datesBetween } from "@/lib/booking";
import { getSectors, getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { dmy, inr, SLOT_LABEL, summary, toISODate, today } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Block, Booking, Lock, Slot } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

const addDays = (iso: string, n: number) => toISODate(new Date(new Date(iso + "T00:00:00Z").getTime() + n * 864e5));

export default async function Bookings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const start = sp.start || today();
  const days = datesBetween(start, addDays(start, 6));
  const [allVenues, sectors, lockSnap] = await Promise.all([
    getVenues(),
    getSectors(),
    db.collection("locks").where("date", ">=", days[0]).where("date", "<=", days[6]).get(),
  ]);
  const venues = allVenues.filter((v) => v.active && (!sp.type || v.type === sp.type) && (!sp.venue || v.id === sp.venue));
  const locks = new Map(lockSnap.docs.map((d) => [d.id, d.data() as Lock]));

  const keep = new URLSearchParams(Object.entries({ start, type: sp.type, venue: sp.venue, sector: sp.sector }).filter(([, v]) => v) as [string, string][]);
  const q = (extra: Record<string, string>) => `?${new URLSearchParams({ ...Object.fromEntries(keep), ...extra })}`;

  // Selected slot details
  const sel = sp.sel ? locks.get(sp.sel) : undefined;
  const selRef = sel && (await db.doc(`${sel.kind === "booking" ? "bookings" : "blocks"}/${sel.refId}`).get());
  const selData = selRef?.exists ? ({ id: selRef.id, ...selRef.data() } as Booking & Block) : null;
  const canSeeHousehold = (sectorId?: string) => isAdmin || sectorId === user.sectorId;

  // Recent bookings
  // shortcut: sector list = equality filter + in-memory sort (no composite index); fine to a few thousand bookings per sector.
  const recent = isAdmin
    ? rows<Booking>(await db.collection("bookings").orderBy("createdAt", "desc").limit(30).get())
    : rows<Booking>(await db.collection("bookings").where("sectorId", "==", user.sectorId).get()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);

  const pill = (venueId: string, date: string, slot: Slot, label: string) => {
    const id = `${venueId}_${date}_${slot}`;
    const l = locks.get(id);
    if (!l) return <Link key={id} className="pill" href={q({ nv: venueId, nd: date, ns: slot }) + "#new"}>{label}</Link>;
    const other = sp.sector && l.kind === "booking" && l.sectorId !== sp.sector ? " other" : "";
    return <Link key={id} className={`pill ${l.status}${other}${sp.sel === id ? " sel" : ""}`} href={q({ sel: id })}>{label}</Link>;
  };

  return (
    <>
      <div className="top"><h1>Hall or Room booking options</h1></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <h2>Filters</h2>
        <form className="row">
          <label>Venue type<select name="type" defaultValue={sp.type}><option value="">All halls &amp; rooms</option><option value="hall">Halls</option><option value="room">Rooms</option></select></label>
          <label>Week starting<input type="date" name="start" defaultValue={start} /></label>
          <label>Venue<select name="venue" defaultValue={sp.venue}><option value="">All venues</option>{allVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label>Booked by<select name="sector" defaultValue={sp.sector}><option value="">All Sectors / Mohallas</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <button className="btn">Apply</button>
        </form>
      </div>

      <div className="card">
        <div className="top" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Availability calendar</h2>
          <span><Link className="btn" href={q({ start: addDays(start, -7) })}>← Prev week</Link> <Link className="btn" href={q({ start: addDays(start, 7) })}>Next week →</Link></span>
        </div>
        <div className="legend"><span className="pill">Available</span><span className="pill pending">On hold (payment pending)</span><span className="pill confirmed">Booked</span><span className="pill block">Unavailable / Miqaat</span></div>
        <table className="cal">
          <thead><tr><th>Venue</th>{days.map((d) => <th key={d}>{new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })}</th>)}</tr></thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id}>
                <td><b>{v.name}</b><div className="muted">{v.type === "hall" ? "Hall" : "Room"}</div></td>
                {days.map((d) => <td key={d}>{v.type === "hall" ? [pill(v.id, d, "M", "M"), pill(v.id, d, "E", "E")] : pill(v.id, d, "D", "Day")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note">Halls book by Morning (M) or Evening (E) slot; both slots = Full day. Rooms book by full day. Click a free slot to start a booking.</div>
      </div>

      <div className="grid g2">
        <div className="card" id="new">
          <h2>New booking</h2>
          <form action={newBooking} className="stack">
            <input type="hidden" name="back" value={keep.toString()} />
            <div className="row">
              {allVenues.filter((v) => v.active).map((v) => (
                <label key={v.id} className="check"><input type="checkbox" name="venueIds" value={v.id} defaultChecked={v.id === sp.nv} />{v.name}</label>
              ))}
            </div>
            <div className="row">
              <label>From<input type="date" name="from" required defaultValue={sp.nd} /></label>
              <label>To (multi-day)<input type="date" name="to" defaultValue={sp.nd} /></label>
              <label>Slot (halls)<select name="slot" defaultValue={sp.ns === "D" ? "D" : sp.ns}><option value="D">Full day</option><option value="M">Morning</option><option value="E">Evening</option></select></label>
            </div>
            <div className="row">
              <label>Household (HOF name)<input name="hhName" required /></label>
              <label>HOF ITS no.<input name="hof" required /></label>
              <label>Mobile (WhatsApp)<input name="hhMobile" required inputMode="numeric" /></label>
              {isAdmin && <label>Sector / Mohalla<select name="sectorId" required><option value="">Select…</option>{sectors.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            </div>
            <div><button className="btn primary">Hold slot &amp; create payment link</button></div>
            <p className="muted">Several venues in one booking are all-or-nothing. Rooms always book by full day.</p>
          </form>
        </div>

        <div className="card">
          <h2>Selected slot</h2>
          {!sel && <p className="muted">Click a booked or blocked slot in the calendar.</p>}
          {sel && selData && sel.kind === "block" && (
            <p><b>{selData.name}</b> · {dmy(selData.from)}{selData.to !== selData.from && ` to ${dmy(selData.to)}`} · {SLOT_LABEL[selData.slot]}<br /><span className="muted">{selData.kind === "miqaat" ? "Miqaat" : "Unavailable"} {selData.notes}</span></p>
          )}
          {sel && selData && sel.kind === "booking" && (
            <div className="stack">
              <p style={{ margin: 0 }}>
                <b>{summary(selData.items)}</b><br />
                Booking {selData.no}{canSeeHousehold(selData.sectorId) && ` · ${selData.household.name} (HOF ${selData.household.hof})`}<br />
                Booked by {selData.sectorName}{selData.status === "confirmed" && ` · ${inr(selData.amount)} paid`}
              </p>
              <div><Badge s={selData.status} /></div>
              {canSeeHousehold(selData.sectorId) && <div><Link className="btn" href={`/bookings/${selData.id}`}>View booking</Link></div>}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>{isAdmin ? "Recent bookings" : "My Sector / Mohalla bookings"}</h2>
        <table>
          <thead><tr><th>Booking</th><th>Venue · date · slot</th><th>Household</th><th>Sector / Mohalla</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/bookings/${b.id}`}>{b.no}</Link></td>
                <td>{summary(b.items)}</td>
                <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                <td>{b.sectorName}</td>
                <td>{inr(b.amount)}</td>
                <td><Badge s={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
