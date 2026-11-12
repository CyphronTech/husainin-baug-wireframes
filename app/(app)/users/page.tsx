import { Icon } from "@/lib/icons";
import Link from "next/link";
import { Select } from "@/lib/dropdown";
import { saveUser, setUserActive } from "@/app/actions";
import { Switch } from "@/lib/switch";
import { getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import type { AppUser } from "@/lib/types";
import { Msg, type SP } from "@/lib/ui";
import { Modal } from "@/lib/modal";

export default async function Users({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const [sectors, all] = await Promise.all([getSectors(), db.collection("users").get().then((s) => rows<AppUser & { id: string }>(s))]);
  const term = (sp.q ?? "").toLowerCase();
  const users = all
    .filter((u) => (!sp.role || u.role === sp.role) && (!term || `${u.id} ${u.name} ${u.mobile} ${u.email}`.toLowerCase().includes(term)))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const e: Partial<AppUser & { id: string }> = all.find((u) => u.id === sp.edit) ?? { role: "sector", active: true };
  const title = e.id ? `Edit: ${e.name}` : "Add user";
  const sectorName = (id: string | null) => (id ? sectors.find((s) => s.id === id)?.name : "All");

  return (
    <>
      <div className="top"><h1>User maintenance</h1><Link className="btn primary btn-icon" href="?add=1" scroll={false}><Icon name="plus" />Add user</Link></div>
      <Msg msg={sp.msg} />
      <div className="card">
          <h2>Users ({users.length})</h2>
          <form className="row mb-3">
            <label>Search<input name="q" defaultValue={sp.q} /></label>
            <Select label="Role" name="role" defaultValue={sp.role}><option value="">All roles</option><option value="admin">Admin</option><option value="sector">Sector / Mohalla user</option></Select>
            <button className="btn btn-icon"><Icon name="filter" />Filter</button>
          </form>
          <table>
            <thead><tr><th>Username</th><th>Name</th><th>Mobile</th><th>Email</th><th>Role</th><th>Sector / Mohalla</th><th>Active</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td><td>{u.name}</td><td>{u.mobile}</td><td>{u.email}</td>
                  <td>{u.role === "admin" ? "Admin" : "Sector / Mohalla user"}</td><td>{sectorName(u.sectorId)}</td>
                  <td><Switch action={setUserActive} fields={{ id: u.id }} on={u.active} label={u.name} onText="Active" offText="Inactive" /></td>
                  <td><Link className="link btn-icon" href={`?edit=${u.id}`} scroll={false}><Icon name="pencil" size={16} />Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      {(sp.add || e.id) && (
        <Modal label={title} close="/users"><div className="modal-form">
          <h2>{title}</h2>
          <form action={saveUser} className="stack" key={e.id ?? "new"}>
            <input type="hidden" name="id" value={e.id ?? ""} />
            <label>Username<input name="username" required defaultValue={e.id} readOnly={!!e.id} /></label>
            <label>{e.id ? "New password (leave blank to keep)" : "Password"}<input name="password" required={!e.id} autoComplete="new-password" /></label>
            <label>Full name<input name="name" required defaultValue={e.name} /></label>
            <label>Mobile<input name="mobile" required defaultValue={e.mobile} /></label>
            <label>Email (optional)<input name="email" type="email" defaultValue={e.email} /></label>
            <Select label="Role" name="role" defaultValue={e.role}><option value="sector">Sector / Mohalla user</option><option value="admin">Admin</option></Select>
            <Select label="Sector / Mohalla" name="sectorId" defaultValue={e.sectorId ?? ""}><option value="">— (Admin)</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            <label className="check"><input type="checkbox" name="active" defaultChecked={e.active} />Active</label>
            <p className="alert info m0">Deactivating a user signs them out and keeps their bookings; Admin can act on them.</p>
            <div className="row modal-actions"><button className="btn primary btn-icon"><Icon name="check" />Save</button><Link className="btn btn-icon" href="/users" scroll={false}><Icon name="x" />Cancel</Link></div>
          </form>
        </div></Modal>
      )}
    </>
  );
}
