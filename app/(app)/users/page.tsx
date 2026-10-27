import Link from "next/link";
import { saveUser } from "@/app/actions";
import { getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import type { AppUser } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

export default async function Users({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const [sectors, all] = await Promise.all([getSectors(), db.collection("users").get().then((s) => rows<AppUser & { id: string }>(s))]);
  const term = (sp.q ?? "").toLowerCase();
  const users = all
    .filter((u) => (!sp.role || u.role === sp.role) && (!term || `${u.id} ${u.name} ${u.mobile} ${u.email}`.toLowerCase().includes(term)))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const e: Partial<AppUser & { id: string }> = all.find((u) => u.id === sp.edit) ?? { role: "sector", active: true };
  const sectorName = (id: string | null) => (id ? sectors.find((s) => s.id === id)?.name : "All");

  return (
    <>
      <div className="top"><h1>User maintenance</h1></div>
      <Msg msg={sp.msg} />
      <div className="grid g2">
        <div className="card">
          <h2>Users</h2>
          <form className="row" style={{ marginBottom: 12 }}>
            <label>Search<input name="q" defaultValue={sp.q} /></label>
            <label>Role<select name="role" defaultValue={sp.role}><option value="">All roles</option><option value="admin">Admin</option><option value="sector">Sector / Mohalla user</option></select></label>
            <button className="btn">Filter</button>
          </form>
          <table>
            <thead><tr><th>Username</th><th>Name</th><th>Mobile</th><th>Email</th><th>Role</th><th>Sector / Mohalla</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td><td>{u.name}</td><td>{u.mobile}</td><td>{u.email}</td>
                  <td>{u.role === "admin" ? "Admin" : "Sector / Mohalla user"}</td><td>{sectorName(u.sectorId)}</td>
                  <td><Badge s={u.active ? "active" : "inactive"} /></td>
                  <td><Link href={`?edit=${u.id}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>{e.id ? `Edit: ${e.name}` : "Add user"}</h2>
          <form action={saveUser} className="stack" key={e.id ?? "new"}>
            <input type="hidden" name="id" value={e.id ?? ""} />
            <label>Username<input name="username" required defaultValue={e.id} readOnly={!!e.id} /></label>
            <label>{e.id ? "New password (leave blank to keep)" : "Password"}<input name="password" required={!e.id} autoComplete="new-password" /></label>
            <label>Full name<input name="name" required defaultValue={e.name} /></label>
            <label>Mobile<input name="mobile" required defaultValue={e.mobile} /></label>
            <label>Email (optional)<input name="email" type="email" defaultValue={e.email} /></label>
            <label>Role<select name="role" defaultValue={e.role}><option value="sector">Sector / Mohalla user</option><option value="admin">Admin</option></select></label>
            <label>Sector / Mohalla<select name="sectorId" defaultValue={e.sectorId ?? ""}><option value="">— (Admin)</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="check"><input type="checkbox" name="active" defaultChecked={e.active} />Active</label>
            <div className="row"><button className="btn primary">Save</button><Link className="btn" href="/users">Cancel</Link></div>
          </form>
          <p className="note">Deactivating a user signs them out and keeps their bookings; Admin can act on them.</p>
        </div>
      </div>
    </>
  );
}
