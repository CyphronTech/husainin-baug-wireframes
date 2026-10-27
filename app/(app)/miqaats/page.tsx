import Link from "next/link";
import { deleteBlockAction, importBlocks, saveBlockAction } from "@/app/actions";
import { getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { dmy, SLOT_LABEL } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { Block } from "@/lib/types";
import { Msg, type SP } from "@/lib/ui";

export default async function Miqaats({ searchParams }: { searchParams: SP }) {
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
          <thead><tr><th>Miqaat</th><th>Dates</th><th>Slot</th><th>Venues</th><th>Clashes flagged</th><th /></tr></thead>
          <tbody>
            {miqaats.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{dmy(m.from)}{m.to !== m.from && ` – ${dmy(m.to)}`}</td>
                <td>{SLOT_LABEL[m.slot]}</td>
                <td>{m.venueIds.map((id) => venues.find((v) => v.id === id)?.name).join(", ")}</td>
                <td className="muted">{m.clashes.join(", ") || "—"}</td>
                <td>
                  <Link href={`?edit=${m.id}#edit`}>Edit</Link>{" "}
                  <form action={deleteBlockAction} style={{ display: "inline" }}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value="/miqaats" /><button className="link">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={importBlocks} className="row" style={{ marginTop: 16 }}>
          <input type="hidden" name="kind" value="miqaat" />
          <a className="btn" href="/blocks-template.csv" download>Download template</a>
          <input type="file" name="file" accept=".csv" required />
          <button className="btn primary">Upload yearly Miqaat list (CSV)</button>
        </form>
        <p className="note">Miqaat dates appear as Unavailable on every Sector / Mohalla calendar. Slots already booked are not blocked and are flagged here.</p>
      </div>

      <div className="card" id="edit">
        <h2>Add or update Miqaat</h2>
        <form action={saveBlockAction} className="stack" key={e.id ?? "new"}>
          <input type="hidden" name="kind" value="miqaat" />
          <input type="hidden" name="id" value={e.id ?? ""} />
          <div className="row">
            <label>Miqaat name<input name="name" required defaultValue={e.name} /></label>
            <label>From date<input type="date" name="from" required defaultValue={e.from} /></label>
            <label>To date<input type="date" name="to" defaultValue={e.to} /></label>
            <label>Slot<select name="slot" defaultValue={e.slot}><option value="D">Full day</option><option value="M">Morning</option><option value="E">Evening</option></select></label>
          </div>
          <div className="row">{venues.map((v) => <label key={v.id} className="check"><input type="checkbox" name="venueIds" value={v.id} defaultChecked={e.venueIds?.includes(v.id)} />{v.name}</label>)}</div>
          <label>Notes<textarea name="notes" rows={2} defaultValue={e.notes} /></label>
          <div className="row"><button className="btn primary">Save Miqaat</button><Link className="btn" href="/miqaats">Cancel</Link></div>
        </form>
      </div>
    </>
  );
}
