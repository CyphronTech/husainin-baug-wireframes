import { logout } from "@/app/actions";
import { CalToggle } from "@/lib/cal-toggle";
import { getSectors } from "@/lib/data";
import { fmt } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, sectors, { hijri }] = await Promise.all([requireUser(), getSectors(), fmt()]);
  const sector = user.sectorId ? sectors.find((s) => s.id === user.sectorId)?.name : null;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><b>Husainin Baug</b><span>Hall &amp; Room Booking</span></div>
        <Nav admin={user.role === "admin"} />
      </aside>
      <div className="main">
        <div className="top noprint justify-end">
          <CalToggle hijri={hijri} />
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
