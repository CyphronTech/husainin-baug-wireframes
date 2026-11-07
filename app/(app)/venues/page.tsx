import { Icon } from "@/lib/icons";
import Link from "next/link";
import { Select } from "@/lib/dropdown";
import { deleteBlockAction, saveBlockAction, saveSector, saveVenue } from "@/app/actions";
import { BlockImport } from "../block-import";
import { DEFAULT_MAX_THAAL, maxThaal } from "@/lib/booking";
import { DateField } from "@/lib/date-field";
import { getHouseholds, getSectors, getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { fmt, inr, SLOT_LABEL, today } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { AppUser, Block, Sector, Venue } from "@/lib/types";
import { Modal } from "@/lib/modal";
import { Badge, Collapsible, Msg, type SP } from "@/lib/ui";

const r = (n?: number) => (n == null ? "—" : inr(n));

export default async function Venues({ searchParams }: { searchParams: SP }) {
  const { dmy, hijri } = await fmt();
  await requireAdmin();
  const sp = await searchParams;
  const [venues, blockSnap, sectors, users, households] = await Promise.all([
    getVenues(),
    db.collection("blocks").where("to", ">=", today()).get(),
    getSectors(),
    db.collection("users").get().then(rows<AppUser>),
    getHouseholds(),
  ]);
  const blocks = rows<Block>(blockSnap).filter((b) => b.kind === "maintenance").sort((a, b) => a.from.localeCompare(b.from));
  const e: Partial<Venue> = venues.find((v) => v.id === sp.edit) ?? { type: "hall", active: true, rates: {}, morningTime: "08:00–15:00", eveningTime: "17:00–23:00" };
  const es: Partial<Sector> = sectors.find((s) => s.id === sp.editSector) ?? { active: true };
  const open = sp.open ?? (sp.editSector || sp.addSector ? "sectors" : "halls");
  const venueTitle = e.id ? `Edit: ${e.name}` : "Add hall or room";
  const sectorTitle = es.id ? `Edit: ${es.name}` : "Add Sector / Mohalla";

  return (
    <>
      <div className="top"><h1>Halls, rooms and sectors</h1></div>
      <Msg msg={sp.msg} />
      <Collapsible className="card" title={<h2>Halls and rooms ({venues.length})</h2>} open={open === "halls"}>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Capacity</th><th>Max thaal</th><th>Morning rate</th><th>Evening rate</th><th>Full-day rate</th><th>Per day (rooms)</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td><td>{v.type === "hall" ? "Hall" : "Room"}</td><td>{v.capacity}</td><td>{v.type === "hall" ? maxThaal(v) : "—"}</td>
                <td>{r(v.rates.morning)}</td><td>{r(v.rates.evening)}</td><td>{r(v.rates.fullDay)}</td><td>{r(v.rates.perDay)}</td>
                <td><Badge s={v.active ? "active" : "inactive"} /></td>
                <td><Link className="link btn-icon" href={`?edit=${v.id}`} scroll={false}><Icon name="pencil" size={16} />Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4"><Link className="btn primary btn-icon" href="?add=1" scroll={false}><Icon name="plus" />Add hall or room</Link></div>
        {(sp.add || e.id) && <Modal label={venueTitle} close="/venues"><div className="modal-form"><h2>{venueTitle}</h2>
          <form action={saveVenue} className="stack">
            <input type="hidden" name="id" value={e.id ?? ""} />
            <fieldset className="stack">
              <legend>Details</legend>
              <div className="row">
                <label>Name *<input name="name" required defaultValue={e.name} /></label>
                <label>Code *<input name="code" required defaultValue={e.code} /></label>
              </div>
              <div className="row">
                <Select label="Type" name="type" defaultValue={e.type}><option value="hall">Hall</option><option value="room">Room</option></Select>
                <label>Capacity (guests)<input name="capacity" type="number" min={0} defaultValue={e.capacity} /></label>
                <label className="hall-only">Max thaal<input name="maxThaal" type="number" min={0} defaultValue={e.maxThaal || DEFAULT_MAX_THAAL} /></label>
              </div>
              <label className="check"><input type="checkbox" name="active" defaultChecked={e.active} />Active (available for booking)</label>
            </fieldset>
            <fieldset className="stack hall-only">
              <legend>Slot times</legend>
              <div className="row">
                <label>Morning slot<input name="morningTime" defaultValue={e.morningTime} /></label>
                <label>Evening slot<input name="eveningTime" defaultValue={e.eveningTime} /></label>
              </div>
            </fieldset>
            <fieldset className="stack">
              <legend>Rates</legend>
              <div className="row hall-only">
                <label>Morning rate (₹)<input name="morning" type="number" min={0} defaultValue={e.rates?.morning} /></label>
                <label>Evening rate (₹)<input name="evening" type="number" min={0} defaultValue={e.rates?.evening} /></label>
              </div>
              <div className="row hall-only">
                <label>Full-day rate (₹)<input name="fullDay" type="number" min={0} defaultValue={e.rates?.fullDay} /></label>
                <label>Multi-day rate per day (₹, optional)<input name="multiDay" type="number" min={0} defaultValue={e.rates?.multiDay} /></label>
              </div>
              <label className="room-only">Rate per day (₹)<input name="perDay" type="number" min={0} defaultValue={e.rates?.perDay} /></label>
              <p className="alert info">Rate changes apply only to bookings made after the change.</p>
            </fieldset>
            <div className="row modal-actions"><button className="btn primary btn-icon"><Icon name="check" />Save</button><Link className="btn btn-icon" href="/venues" scroll={false}><Icon name="x" />Cancel</Link></div>
          </form>
        </div></Modal>}
      </Collapsible>

      <Collapsible className="card" id="block" title={<h2>Mark unavailable (maintenance, events)</h2>} open={open === "block"}>
        <form action={saveBlockAction} className="stack">
          <input type="hidden" name="kind" value="maintenance" />
          <div className="row">{venues.map((v) => <label key={v.id} className="check"><input type="checkbox" name="venueIds" value={v.id} />{v.name}</label>)}</div>
          <div className="row">
            <Select label="Slot" name="slot"><option value="D">Full day</option><option value="M">Morning</option><option value="E">Evening</option></Select>
            <label>From date<DateField hijri={hijri} name="from" required /></label>
            <label>To date<DateField hijri={hijri} name="to" /></label>
          </div>
          <label>Reason<input name="name" required /></label>
          <div><button className="btn primary btn-icon"><Icon name="plus" />Add block</button></div>
        </form>
        <table className="mt-3">
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td><td>{dmy(b.from)}{b.to !== b.from && ` – ${dmy(b.to)}`}</td><td>{SLOT_LABEL[b.slot]}</td>
                <td>{b.venueIds.map((id) => venues.find((v) => v.id === id)?.name).join(", ")}</td>
                <td><form action={deleteBlockAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value="/venues" /><button className="link btn-icon"><Icon name="trash" size={16} />Remove</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Collapsible title={<h3>Bulk upload for the year</h3>}>
          <BlockImport kind="maintenance" label="Upload CSV / Excel" />
        </Collapsible>
      </Collapsible>

      <Collapsible className="card" title={<h2>Sectors / Mohallas ({sectors.length})</h2>} open={open === "sectors"}>
        <table>
          <thead><tr><th>Sector / Mohalla</th><th>Code</th><th>Users</th><th>Households</th><th>Contact</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {sectors.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.code}</td><td>{users.filter((u) => u.sectorId === s.id).length}</td><td><Link href={`/households?sector=${s.id}`}>{households.filter((h) => h.sectorId === s.id).length}</Link></td>
                <td>{s.contactName}<div className="muted">{s.contactMobile}</div></td>
                <td><Badge s={s.active ? "active" : "inactive"} /></td>
                <td><Link className="link btn-icon" href={`?editSector=${s.id}`} scroll={false}><Icon name="pencil" size={16} />Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4"><Link className="btn primary btn-icon" href="?addSector=1" scroll={false}><Icon name="plus" />Add Sector / Mohalla</Link></div>
        {(sp.addSector || es.id) && <Modal label={sectorTitle} close="/venues?open=sectors"><div className="modal-form"><h2>{sectorTitle}</h2>
          <form action={saveSector} className="stack">
            <input type="hidden" name="id" value={es.id ?? ""} />
            <fieldset className="stack">
              <legend>Details</legend>
              <div className="row">
                <label>Sector / Mohalla name *<input name="name" required defaultValue={es.name} /></label>
                <label>Code *<input name="code" required defaultValue={es.code} /></label>
              </div>
              <label className="check"><input type="checkbox" name="active" defaultChecked={es.active} />Active</label>
            </fieldset>
            <fieldset className="stack">
              <legend>Contact</legend>
              <div className="row">
                <label>Contact person<input name="contactName" defaultValue={es.contactName} /></label>
                <label>Contact mobile<input name="contactMobile" type="tel" defaultValue={es.contactMobile} /></label>
              </div>
            </fieldset>
            <p className="alert info">Users are linked to one Sector / Mohalla. Bookings are visible to all on the calendar; household details only to their own Sector / Mohalla.</p>
            <div className="row modal-actions"><button className="btn primary btn-icon"><Icon name="check" />Save</button><Link className="btn btn-icon" href="/venues?open=sectors" scroll={false}><Icon name="x" />Cancel</Link></div>
          </form>
        </div></Modal>}
      </Collapsible>
    </>
  );
}
