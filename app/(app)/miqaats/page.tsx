import Link from "next/link";
import { deleteBlockAction, saveBlockAction } from "@/app/actions";
import { BlockImport } from "../block-import";
import { DateField } from "@/lib/date-field";
import { getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { fmt, SLOT_LABEL } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { Block } from "@/lib/types";
import { Msg, type SP } from "@/lib/ui";

export default async function Miqaats({ searchParams }: { searchParams: SP }) {
  const { dmy, hijri } = await fmt();
  await requireAdmin();
  const sp = await searchParams;
  const [venues, snap] = await Promise.all([getVenues(), db.collection("blocks").where("kind", "==", "miqaat").get()]);
  const miqaats = rows<Block>(snap).sort((a, b) => a.from.localeCompare(b.from));
  const e: Partial<Block> = miqaats.find((m) => m.id === sp.edit) ?? { slot: "D", venueIds: [] };

  return (
    <>
      <div className="top"><h1>Update Miqaat details</h1></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <h2>Miqaat calendar</h2>
        <table>
          <thead><tr><th>Miqaat</th><th>Dates</th><th>Slot</th><th>Venues</th><th>Booking block</th><th>Clashes flagged</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {miqaats.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{dmy(m.from)}{m.to !== m.from && ` – ${dmy(m.to)}`}</td>
                <td>{SLOT_LABEL[m.slot]}</td>
                <td>{m.venueIds.map((id) => venues.find((v) => v.id === id)?.name).join(", ")}</td>
                <td>{m.blocking === false ? "Not blocked" : "Blocked"}</td>
                <td className="muted">{m.clashes.join(", ") || "—"}</td>
                <td>
                  <Link href={`?edit=${m.id}#edit`}>Edit</Link>{" "}
                  <form className="inline" action={deleteBlockAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value="/miqaats" /><button className="link">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4"><BlockImport kind="miqaat" label="Upload yearly Miqaat list (CSV / Excel)" /></div>
        <p className="alert info">Blocked Miqaat dates appear as Unavailable on every Sector / Mohalla calendar. Slots already booked are not blocked and are flagged here.</p>
      </div>

      <div className="card" id="edit">
        <h2>Add or update Miqaat</h2>
        <form action={saveBlockAction} className="stack" key={e.id ?? "new"}>
          <input type="hidden" name="kind" value="miqaat" />
          <input type="hidden" name="id" value={e.id ?? ""} />
          <div className="row">
            <label>Miqaat name<input name="name" required defaultValue={e.name} /></label>
            <label>From date<DateField hijri={hijri} name="from" required defaultValue={e.from} /></label>
            <label>To date<DateField hijri={hijri} name="to" defaultValue={e.to} /></label>
            <label>Slot<select name="slot" defaultValue={e.slot}><option value="D">Full day</option><option value="M">Morning</option><option value="E">Evening</option></select></label>
          </div>
          <div className="row">{venues.map((v) => <label key={v.id} className="check"><input type="checkbox" name="venueIds" value={v.id} defaultChecked={e.venueIds?.includes(v.id)} />{v.name}</label>)}</div>
          <label>Notes<textarea name="notes" rows={2} defaultValue={e.notes} /></label>
          <label className="check"><input type="checkbox" name="blocking" defaultChecked={e.blocking !== false} />Block these venues for booking</label>
          <div className="row"><button className="btn primary">Save Miqaat</button><Link className="btn" href="/miqaats">Cancel</Link></div>
        </form>
      </div>
    </>
  );
}
