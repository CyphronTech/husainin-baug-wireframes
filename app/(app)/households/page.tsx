import Link from "next/link";
import { saveHousehold } from "@/app/actions";
import { getHouseholds, getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/session";
import type { Booking, Household } from "@/lib/types";
import { Msg, type SP } from "@/lib/ui";
import { HouseholdImport } from "./import";

export default async function Households({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "admin";
  const sectors = await getSectors();
  // Admin picks a sector to work in; sector users are fixed to their own.
  const sectorId = isAdmin ? sp.sector : user.sectorId!;
  const [households, bookings] = sectorId
    ? await Promise.all([getHouseholds(sectorId), db.collection("bookings").where("sectorId", "==", sectorId).get().then(rows<Booking>)])
    : [[], []];
  const term = (sp.q ?? "").toLowerCase();
  const list = households.filter((h) => !term || `${h.hof} ${h.name} ${h.mobile}`.toLowerCase().includes(term));
  const e: Partial<Household> = households.find((h) => h.id === sp.edit) ?? { whatsappConsent: true };
  const sectorName = sectors.find((s) => s.id === sectorId)?.name;
  const keep = (o: Record<string, string>) => `?${new URLSearchParams({ ...(sp.sector && { sector: sp.sector }), ...(sp.back && { back: sp.back }), ...o })}`;

  return (
    <>
      <div className="top"><h1>Add or upload household details</h1></div>
      <Msg msg={sp.msg} />
      {isAdmin && (
        <div className="card">
          <form className="row"><label>Sector / Mohalla<select name="sector" defaultValue={sp.sector}><option value="">Select…</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="btn">Open</button></form>
        </div>
      )}
      {sectorId && (
        <>
          <div className="grid g2e mb-5">
            <div className="card">
              <h2>{e.id ? `Edit household ${e.hof}` : "Add household"}</h2>
              <form action={saveHousehold} className="stack" key={e.id ?? "new"}>
                <input type="hidden" name="back" value={sp.back ?? ""} />
                <input type="hidden" name="sectorId" value={sectorId} />
                <label>Head of family name<input name="name" required defaultValue={e.name} /></label>
                <label>HOF ID<input name="hof" required pattern="\d{8,10}" title="8–10 digits" defaultValue={e.hof} readOnly={!!e.id} /></label>
                <label>Mobile (WhatsApp)<input name="mobile" required defaultValue={e.mobile} /></label>
                <label>Address<input name="address" defaultValue={e.address} /></label>
                <label>Sector / Mohalla<input value={sectorName} disabled /></label>
                <label className="check"><input type="checkbox" name="whatsappConsent" defaultChecked={e.whatsappConsent} />Household agrees to receive WhatsApp messages</label>
                <div className="row"><button className="btn primary">Save household</button><Link className="btn" href={keep({})}>Clear</Link>{sp.back && <Link className="btn" href={sp.back}>Back to booking</Link>}</div>
              </form>
            </div>
            <div className="card">
              <h2>Upload households (CSV)</h2>
              <HouseholdImport known={households.map((h) => h.hof)} sectorId={isAdmin ? sectorId : undefined} />
            </div>
          </div>
          <div className="card">
            <div className="top mb-2">
              <h2 className="m0">Households · {sectorName} ({households.length})</h2>
              <form className="row">{sp.sector && <input type="hidden" name="sector" value={sp.sector} />}<input name="q" defaultValue={sp.q} placeholder="Search" /><button className="btn">Search</button></form>
            </div>
            <table>
              <thead><tr><th>HOF ID</th><th>Name</th><th>Mobile</th><th>WhatsApp consent</th><th>Bookings</th><th /></tr></thead>
              <tbody>
                {list.map((h) => (
                  <tr key={h.id}>
                    <td>{h.hof}</td><td>{h.name}</td><td>{h.mobile}</td><td>{h.whatsappConsent ? "Yes" : "No"}</td>
                    <td>{bookings.filter((b) => b.household.hof === h.hof).length}</td>
                    <td><Link href={keep({ edit: h.id })}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
