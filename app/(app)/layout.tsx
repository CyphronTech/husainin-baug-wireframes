import { Fragment } from "react";
import { logout, setCalendar } from "@/app/actions";
import { CalButtons } from "@/lib/cal-toggle";
import { getSectors } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, sectors] = await Promise.all([requireUser(), getSectors()]);
  const sector = user.sectorId ? sectors.find((s) => s.id === user.sectorId)?.name : null;
  const hijri = user.cal !== "en";
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><b>Husainin Baug</b><span>Hall &amp; Room Booking</span></div>
        <Nav admin={user.role === "admin"} />
      </aside>
      <div className="main">
        <div className="top noprint justify-end">
          <form action={setCalendar} className="caltoggle" role="group" aria-label="Show dates first in" title="Which calendar's date shows first">
            <CalButtons hijri={hijri} />
          </form>
          <form action={logout} className="chip">
            <span>{user.name}<small>{user.role === "admin" ? "Admin" : sector}</small></span>
            <button className="link">Sign out</button>
          </form>
        </div>
        {/* Remount on toggle so uncontrolled fields (month selects, date pickers) pick up the new calendar. */}
        <Fragment key={hijri ? "hijri" : "en"}>{children}</Fragment>
      </div>
    </div>
  );
}
