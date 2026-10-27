import { logout } from "@/app/actions";
import { getSectors } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const sector = user.sectorId ? (await getSectors()).find((s) => s.id === user.sectorId)?.name : null;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><b>Husainin Baug</b><span>Hall &amp; Room Booking</span></div>
        <Nav admin={user.role === "admin"} />
      </aside>
      <div className="main">
        <div className="top noprint justify-end">
          <form action={logout} className="chip">
            <span>{user.name}<small>{user.role === "admin" ? "Admin" : sector}</small></span>
            <button className="link">Sign out</button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
