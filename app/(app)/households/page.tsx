import { Icon } from "@/lib/icons";
import Link from "next/link";
import { Select } from "@/lib/dropdown";
import { saveHousehold } from "@/app/actions";
import { getHouseholds, getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/session";
import type { Booking, Household } from "@/lib/types";
import { Msg, type SP } from "@/lib/ui";
import { HouseholdImport } from "./import";

const PAGE_SIZE = 20;

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
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(sp.page)) || 1), pages);
  const first = (page - 1) * PAGE_SIZE;
  const shown = list.slice(first, first + PAGE_SIZE);
  const inList = (o: Record<string, string>) => keep({ ...(sp.q && { q: sp.q }), ...(page > 1 && { page: String(page) }), ...o });
  const step = (to: number, label: string) =>
    to < 1 || to > pages ? <button className="btn" disabled>{label}</button> : <Link prefetch={false} scroll={false} className="btn" href={inList({ page: String(to) })}>{label}</Link>;

  return (
    <>
      <div className="top"><h1>Add or upload household details</h1></div>
      <Msg msg={sp.msg} />
      {isAdmin && (
        <div className="card">
          <form className="row">{sp.back && <input type="hidden" name="back" value={sp.back} />}<Select label="Sector / Mohalla" name="sector" defaultValue={sp.sector}><option value="">Select…</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><button className="btn btn-icon">Open<Icon name="next" /></button></form>
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
                <div className="row"><button className="btn primary btn-icon"><Icon name="check" />Save household</button><Link className="btn btn-icon" href={keep({})}><Icon name="x" />Clear</Link>{sp.back?.startsWith("/book/") && <Link className="btn btn-icon" href={sp.back}><Icon name="back" />Back to booking</Link>}</div>
              </form>
            </div>
            <div className="card">
              <h2>Upload households (CSV / Excel)</h2>
              <HouseholdImport known={households.map((h) => h.hof)} sectorId={isAdmin ? sectorId : undefined} />
            </div>
          </div>
          <div className="card">
            <div className="top mb-2">
              <h2 className="m0">Households · {sectorName} ({households.length})</h2>
              <form className="row">{sp.sector && <input type="hidden" name="sector" value={sp.sector} />}{sp.back && <input type="hidden" name="back" value={sp.back} />}<input name="q" defaultValue={sp.q} placeholder="Search" /><button className="btn btn-icon"><Icon name="search" />Search</button></form>
            </div>
            <table>
              <thead><tr><th>HOF ID</th><th>Name</th><th>Mobile</th><th>WhatsApp consent</th><th>Bookings</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {shown.map((h) => (
                  <tr key={h.id}>
                    <td>{h.hof}</td><td>{h.name}</td><td>{h.mobile}</td><td>{h.whatsappConsent ? "Yes" : "No"}</td>
                    <td>{bookings.filter((b) => b.household.hof === h.hof).length}</td>
                    <td><Link className="link btn-icon" href={inList({ edit: h.id })}><Icon name="pencil" size={16} />Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <nav className="top m0 mt-3" aria-label="Household pages">
                <span className="muted">{first + 1}–{first + shown.length} of {list.length}</span>
                <span className="row items-center">{step(page - 1, "← Prev")}<span>Page {page} of {pages}</span>{step(page + 1, "Next →")}</span>
              </nav>
            )}
          </div>
        </>
      )}
    </>
  );
}
