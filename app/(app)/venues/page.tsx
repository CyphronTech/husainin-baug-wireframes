import Link from "next/link";
import { deleteBlockAction, importBlocks, saveBlockAction, saveVenue } from "@/app/actions";
import { getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { dmy, inr, SLOT_LABEL, today } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { Block, Venue } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

const r = (n?: number) => (n == null ? "—" : inr(n));

export default async function Venues({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const [venues, blockSnap] = await Promise.all([getVenues(), db.collection("blocks").where("to", ">=", today()).get()]);
  const blocks = rows<Block>(blockSnap).filter((b) => b.kind === "maintenance").sort((a, b) => a.from.localeCompare(b.from));
  const e: Partial<Venue> = venues.find((v) => v.id === sp.edit) ?? { type: "hall", active: true, rates: {}, morningTime: "08:00–15:00", eveningTime: "17:00–23:00" };

  return (
    <>
      <div className="top"><h1>Hall or Room configuration</h1></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <h2>Halls and rooms</h2>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Capacity</th><th>Morning rate</th><th>Evening rate</th><th>Full-day rate</th><th>Per day (rooms)</th><th>Status</th><th /></tr></thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td><td>{v.type === "hall" ? "Hall" : "Room"}</td><td>{v.capacity}</td>
                <td>{r(v.rates.morning)}</td><td>{r(v.rates.evening)}</td><td>{r(v.rates.fullDay)}</td><td>{r(v.rates.perDay)}</td>
                <td><Badge s={v.active ? "active" : "inactive"} /></td>
                <td><Link href={`?edit=${v.id}#edit`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><Link href="?#edit">+ Add hall or room</Link></p>
      </div>

      <div className="grid g2e">
        <div className="card" id="edit">
          <h2>{e.id ? `Edit: ${e.name}` : "Add hall or room"}</h2>
          <form action={saveVenue} className="stack" key={e.id ?? "new"}>
            <input type="hidden" name="id" value={e.id ?? ""} />
            <div className="row">
              <label>Name<input name="name" required defaultValue={e.name} /></label>
              <label>Code<input name="code" required defaultValue={e.code} /></label>
            </div>
            <div className="row">
              <label>Type<select name="type" defaultValue={e.type}><option value="hall">Hall</option><option value="room">Room</option></select></label>
              <label>Capacity (guests)<input name="capacity" type="number" defaultValue={e.capacity} /></label>
            </div>
            <div className="row">
              <label>Morning slot time<input name="morningTime" defaultValue={e.morningTime} /></label>
              <label>Evening slot time<input name="eveningTime" defaultValue={e.eveningTime} /></label>
            </div>
            <div className="row">
              <label>Morning rate (₹)<input name="morning" type="number" defaultValue={e.rates?.morning} /></label>
              <label>Evening rate (₹)<input name="evening" type="number" defaultValue={e.rates?.evening} /></label>
              <label>Full-day rate (₹)<input name="fullDay" type="number" defaultValue={e.rates?.fullDay} /></label>
            </div>
            <div className="row">
              <label>Multi-day rate per day (₹, optional, halls)<input name="multiDay" type="number" defaultValue={e.rates?.multiDay} /></label>
              <label>Per day (₹, rooms)<input name="perDay" type="number" defaultValue={e.rates?.perDay} /></label>
            </div>
            <label className="check"><input type="checkbox" name="active" defaultChecked={e.active} />Active (available for booking)</label>
            <p className="note">Rate changes apply only to bookings made after the change.</p>
            <div className="row"><button className="btn primary">Save</button><Link className="btn" href="/venues">Cancel</Link></div>
          </form>
        </div>

        <div>
          <div className="card" id="block">
            <h2>Mark unavailable (maintenance, events)</h2>
            <form action={saveBlockAction} className="stack">
              <input type="hidden" name="kind" value="maintenance" />
              <div className="row">{venues.map((v) => <label key={v.id} className="check"><input type="checkbox" name="venueIds" value={v.id} />{v.name}</label>)}</div>
              <div className="row">
                <label>Slot<select name="slot"><option value="D">Full day</option><option value="M">Morning</option><option value="E">Evening</option></select></label>
                <label>From date<input type="date" name="from" required /></label>
                <label>To date<input type="date" name="to" /></label>
              </div>
              <label>Reason<input name="name" required /></label>
              <div><button className="btn primary">Add block</button></div>
            </form>
            <table style={{ marginTop: 12 }}>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td><td>{dmy(b.from)}{b.to !== b.from && ` – ${dmy(b.to)}`}</td><td>{SLOT_LABEL[b.slot]}</td>
                    <td>{b.venueIds.map((id) => venues.find((v) => v.id === id)?.name).join(", ")}</td>
                    <td><form action={deleteBlockAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value="/venues" /><button className="link">Remove</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2>Bulk upload for the year</h2>
            <form action={importBlocks} className="row">
              <input type="hidden" name="kind" value="maintenance" />
              <a className="btn" href="/blocks-template.csv" download>Download template</a>
              <input type="file" name="file" accept=".csv" required />
              <button className="btn primary">Upload CSV</button>
            </form>
            <p className="note">Rows that clash with an existing booking are skipped and reported back.</p>
          </div>
        </div>
      </div>
    </>
  );
}
