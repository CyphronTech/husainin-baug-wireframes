import Link from "next/link";
import { saveSector } from "@/app/actions";
import { getHouseholds, getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import type { AppUser, Sector } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

export default async function Sectors({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const [sectors, users, households] = await Promise.all([getSectors(), db.collection("users").get().then(rows<AppUser>), getHouseholds()]);
  const e: Partial<Sector> = sectors.find((s) => s.id === sp.edit) ?? { active: true };

  return (
    <>
      <div className="top"><h1>Sector or Mohalla setup</h1></div>
      <Msg msg={sp.msg} />
      <div className="grid g2">
        <div className="card">
          <h2>Sectors / Mohallas ({sectors.length})</h2>
          <table>
            <thead><tr><th>Sector / Mohalla</th><th>Code</th><th>Users</th><th>Households</th><th>Contact</th><th>Status</th><th /></tr></thead>
            <tbody>
              {sectors.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.code}</td><td>{users.filter((u) => u.sectorId === s.id).length}</td><td><Link href={`/households?sector=${s.id}`}>{households.filter((h) => h.sectorId === s.id).length}</Link></td>
                  <td>{s.contactName}<div className="muted">{s.contactMobile}</div></td>
                  <td><Badge s={s.active ? "active" : "inactive"} /></td>
                  <td><Link href={`?edit=${s.id}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Add or edit Sector / Mohalla</h2>
          <form action={saveSector} className="stack" key={e.id ?? "new"}>
            <input type="hidden" name="id" value={e.id ?? ""} />
            <label>Sector / Mohalla name<input name="name" required defaultValue={e.name} /></label>
            <label>Code<input name="code" required defaultValue={e.code} /></label>
            <label>Contact person<input name="contactName" defaultValue={e.contactName} /></label>
            <label>Contact mobile<input name="contactMobile" defaultValue={e.contactMobile} /></label>
            <label className="check"><input type="checkbox" name="active" defaultChecked={e.active} />Active</label>
            <div className="row"><button className="btn primary">Save</button><Link className="btn" href="/sectors">Cancel</Link></div>
          </form>
          <p className="alert info">Users are linked to one Sector / Mohalla. Bookings are visible to all on the calendar; household details only to their own Sector / Mohalla.</p>
        </div>
      </div>
    </>
  );
}
