import { Icon } from "@/lib/icons";
import Link from "next/link";
import { Select } from "@/lib/dropdown";
import { deleteBlockAction, saveBlockAction, saveRoomType, saveSector, saveVenue, setSectorActive } from "@/app/actions";
import { Switch } from "@/lib/switch";
import { OnOff } from "./on-off";
import { BlockImport } from "../block-import";
import { DEFAULT_MAX_THAAL, maxThaal, roomType } from "@/lib/booking";
import { DateField } from "@/lib/date-field";
import { getHouseholds, getSectors, getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { fmt, inr, SLOT_LABEL, today } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { AppUser, Block, Sector, Venue } from "@/lib/types";
import { Modal } from "@/lib/modal";
import { Collapsible, Msg, type SP } from "@/lib/ui";

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
  const halls = venues.filter((v) => v.type === "hall");
  const roomTypes = [...new Set(venues.filter((v) => v.type === "room").map(roomType))].map((name) => {
    const rooms = venues.filter((v) => v.type === "room" && roomType(v) === name);
    const rates = [...new Set(rooms.map((v) => v.rates.perDay))];
    return { name, rooms, on: rooms.filter((v) => v.active), rate: rates.length === 1 ? r(rates[0]) : "Varies" };
  });
  // Popups: ?add=hall / ?edit=<hall> → hall form; ?add=room / ?roomType=<name> (or ?edit=<room>) → room type form.
  const edited = venues.find((v) => v.id === sp.edit);
  const e: Partial<Venue> = edited?.type === "hall" ? edited : { type: "hall", active: true, rates: {}, morningTime: "08:00–15:00", eveningTime: "17:00–23:00" };
  const hallOpen = sp.add === "hall" || sp.add === "1" || edited?.type === "hall";
  const rt = roomTypes.find((t) => t.name === (sp.roomType ?? (edited?.type === "room" ? roomType(edited) : undefined)));
  const roomOpen = sp.add === "room" || !!rt;
  const es: Partial<Sector> = sectors.find((s) => s.id === sp.editSector) ?? { active: true };
  const open = sp.open ?? (sp.editSector || sp.addSector ? "sectors" : sp.addBlock ? "block" : "halls");
  const venueTitle = e.id ? `Edit: ${e.name}` : "Add hall";
  const roomTitle = rt ? `Edit: ${rt.name}` : "Add room type";
  const sectorTitle = es.id ? `Edit: ${es.name}` : "Add Sector / Mohalla";

  return (
    <>
      <div className="top">
        <h1>Halls, rooms and sectors</h1>
        <span className="row">
          <Link className="btn btn-icon" href="?add=room" scroll={false}><Icon name="plus" />Add room type</Link>
          <Link className="btn primary btn-icon" href="?add=hall" scroll={false}><Icon name="plus" />Add hall</Link>
        </span>
      </div>
      <Msg msg={sp.msg} />
      <Collapsible className="card" title={<h2>Halls and rooms ({venues.length})</h2>} open={open === "halls"}>
        <h3 className="mb-2">Halls ({halls.length})</h3>
        <table className="resp">
          <thead><tr><th>Hall</th><th>Size</th><th>AC</th><th>Rate</th><th>Open for booking</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {halls.map((v) => (
              <tr key={v.id}>
                <td data-label="Hall"><b>{v.name}</b></td>
                <td data-label="Size">{maxThaal(v)} thaal · {v.capacity} guests</td>
                <td data-label="AC">{v.ac ? "AC" : "Non-AC"}</td>
                <td data-label="Rate">
                  <span>{r(v.rates.morning)} / session<span className="muted" style={{ display: "block" }}>{v.rates.evening !== v.rates.morning && `Evening ${r(v.rates.evening)} · `}Full day {r(v.rates.fullDay)}</span></span>
                </td>
                <td data-label="Open for booking"><OnOff ids={[v.id]} on={v.active} label={v.name} /></td>
                <td><Link className="link btn-icon" href={`?edit=${v.id}`} scroll={false}><Icon name="pencil" size={16} />Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mb-2 mt-5">Rooms ({roomTypes.reduce((a, t) => a + t.rooms.length, 0)})</h3>
        <table className="resp">
          <thead><tr><th>Room type</th><th>Rooms</th><th>Persons</th><th>Rate</th><th>Open for booking</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {roomTypes.map((t) => (
              <tr key={t.name}>
                <td data-label="Room type"><b>{t.name}</b></td>
                <td data-label="Rooms">{t.on.length === t.rooms.length ? `${t.rooms.length}` : `${t.on.length} open of ${t.rooms.length}`}</td>
                <td data-label="Persons">{t.rooms[0].capacity} per room</td>
                <td data-label="Rate">{t.rate} / day</td>
                <td data-label="Open for booking"><OnOff ids={t.rooms.map((v) => v.id)} on={t.on.length > 0} label={t.name} /></td>
                <td><Link className="link btn-icon" href={`?${new URLSearchParams({ roomType: t.name })}`} scroll={false}><Icon name="pencil" size={16} />Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>

        {hallOpen && <Modal label={venueTitle} close="/venues"><div className="modal-form"><h2>{venueTitle}</h2>
          <form action={saveVenue} className="stack">
            <input type="hidden" name="id" value={e.id ?? ""} />
            <input type="hidden" name="type" value="hall" />
            <div className="row">
              <label>Hall name *<input name="name" required defaultValue={e.name} placeholder="e.g. Vajihi Hall" /></label>
              <label>Code *<input name="code" required defaultValue={e.code} placeholder="e.g. VAJ" /></label>
            </div>
            <div className="row">
              <label>Max thaal<input name="maxThaal" type="number" inputMode="numeric" min={0} defaultValue={e.maxThaal || DEFAULT_MAX_THAAL} /></label>
              <label>Guests<input name="capacity" type="number" inputMode="numeric" min={0} defaultValue={e.capacity} /></label>
            </div>
            <label className="check"><input type="checkbox" name="ac" defaultChecked={e.ac} />Air-conditioned (AC)</label>
            <label>Rate per session (₹) *<input name="session" type="number" inputMode="numeric" min={0} required defaultValue={e.rates?.morning} /></label>
            <details className="more" open={!!e.id && (e.rates?.evening !== e.rates?.morning || e.rates?.fullDay !== (e.rates?.morning ?? 0) + (e.rates?.evening ?? 0) || !!e.rates?.multiDay)}>
              <summary>More rates and slot times</summary>
              <div className="stack mt-3">
                <div className="row">
                  <label>Evening rate, if different (₹)<input name="evening" type="number" min={0} defaultValue={e.rates?.evening !== e.rates?.morning ? e.rates?.evening : undefined} /></label>
                  <label>Full-day rate (₹)<input name="fullDay" type="number" min={0} placeholder="Blank = both sessions" defaultValue={e.rates?.fullDay !== (e.rates?.morning ?? 0) + (e.rates?.evening ?? 0) ? e.rates?.fullDay : undefined} /></label>
                </div>
                <label>Multi-day rate per day (₹, optional)<input name="multiDay" type="number" min={0} defaultValue={e.rates?.multiDay} /></label>
                <div className="row">
                  <label>Morning slot<input name="morningTime" defaultValue={e.morningTime} /></label>
                  <label>Evening slot<input name="eveningTime" defaultValue={e.eveningTime} /></label>
                </div>
              </div>
            </details>
            <label className="check"><input type="checkbox" name="active" defaultChecked={e.active} />Open for booking</label>
            <p className="alert info m0">Rate changes apply only to bookings made after the change.</p>
            <div className="row modal-actions"><button className="btn primary btn-icon"><Icon name="check" />Save</button><Link className="btn btn-icon" href="/venues" scroll={false}><Icon name="x" />Cancel</Link></div>
          </form>
        </div></Modal>}

        {roomOpen && <Modal label={roomTitle} close="/venues"><div className="modal-form"><h2>{roomTitle}</h2>
          <form action={saveRoomType} className="stack">
            <input type="hidden" name="oldType" value={rt?.name ?? ""} />
            <div className="row">
              <label>Room type *<input name="name" required defaultValue={rt?.name} placeholder="e.g. Deluxe Room" /></label>
              {!rt && <label>Code *<input name="code" required pattern="[A-Za-z]{2,6}" title="2–6 letters" placeholder="e.g. DLX" /></label>}
            </div>
            <div className="row">
              <label>Number of rooms *<input name="count" type="number" inputMode="numeric" min={0} max={50} required defaultValue={rt ? rt.on.length : 1} /></label>
              <label>Persons per room<input name="capacity" type="number" inputMode="numeric" min={0} defaultValue={rt?.rooms[0].capacity ?? 4} /></label>
            </div>
            <label>Rate per day (₹) *<input name="perDay" type="number" inputMode="numeric" min={0} required defaultValue={rt?.rooms[0].rates.perDay} /></label>
            <label className="check"><input type="checkbox" name="active" defaultChecked={rt ? rt.on.length > 0 : true} />Open for booking</label>
            <p className="alert info m0">Rooms are named {rt?.name ?? "Deluxe Room"} 1, 2, 3… Lowering the number closes the highest-numbered rooms; their bookings stay.</p>
            <div className="row modal-actions"><button className="btn primary btn-icon"><Icon name="check" />Save</button><Link className="btn btn-icon" href="/venues" scroll={false}><Icon name="x" />Cancel</Link></div>
          </form>
        </div></Modal>}
      </Collapsible>

      <Collapsible className="card" id="block" title={<h2>Mark unavailable (maintenance, events)</h2>} open={open === "block"}>
        <div className="top mb-2">
          <span className="muted">Closes halls or rooms for repairs or events.</span>
          <Link className="btn btn-icon" href="?addBlock=1&open=block" scroll={false}><Icon name="plus" />Mark unavailable</Link>
        </div>
        {sp.addBlock && <Modal label="Mark unavailable" close="/venues?open=block"><div className="modal-form"><h2>Mark unavailable</h2>
          <form action={saveBlockAction} className="stack">
            <input type="hidden" name="kind" value="maintenance" />
            <label>Reason *<input name="name" required placeholder="e.g. AC repair" /></label>
            <div className="row">
              <label>From date *<DateField hijri={hijri} name="from" required /></label>
              <label>To date<DateField hijri={hijri} name="to" /></label>
              <Select label="Slot" name="slot"><option value="D">Full day</option><option value="M">Morning</option><option value="E">Evening</option></Select>
            </div>
            <fieldset className="stack"><legend>Halls and rooms</legend>
              <div className="row">{venues.map((v) => <label key={v.id} className="check"><input type="checkbox" name="venueIds" value={v.id} />{v.name}</label>)}</div>
            </fieldset>
            <div className="row modal-actions"><button className="btn primary btn-icon"><Icon name="check" />Save</button><Link className="btn btn-icon" href="/venues?open=block" scroll={false}><Icon name="x" />Cancel</Link></div>
          </form>
        </div></Modal>}
        <table className="mt-3">
          <thead><tr><th>Reason</th><th>Dates</th><th>Slot</th><th>Halls and rooms</th><th><span className="sr-only">Actions</span></th></tr></thead>
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
        <div className="top mb-2 justify-end"><Link className="btn btn-icon" href="?addSector=1" scroll={false}><Icon name="plus" />Add Sector / Mohalla</Link></div>
        <table>
          <thead><tr><th>Sector / Mohalla</th><th>Code</th><th>Users</th><th>Households</th><th>Contact</th><th>Active</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {sectors.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.code}</td><td>{users.filter((u) => u.sectorId === s.id).length}</td><td><Link href={`/households?sector=${s.id}`}>{households.filter((h) => h.sectorId === s.id).length}</Link></td>
                <td>{s.contactName}<div className="muted">{s.contactMobile}</div></td>
                <td><Switch action={setSectorActive} fields={{ id: s.id }} on={s.active} label={s.name} onText="Active" offText="Inactive" /></td>
                <td><Link className="link btn-icon" href={`?editSector=${s.id}`} scroll={false}><Icon name="pencil" size={16} />Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
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
