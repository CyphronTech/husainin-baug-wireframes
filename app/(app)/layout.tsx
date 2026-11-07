import Link from "next/link";
import { logout } from "@/app/actions";
import { getSectors } from "@/lib/data";
import { Icon } from "@/lib/icons";
import { NavProgress } from "@/lib/nav-progress";
import { TrackPage } from "@/lib/modal";
import { requireUser } from "@/lib/session";
import { Nav } from "./nav";

export default async function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const [user, sectors] = await Promise.all([requireUser(), getSectors()]);
  const sector = user.sectorId ? sectors.find((s) => s.id === user.sectorId)?.name : null;
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><b>Husainin Baug</b><span>Hall &amp; Room Booking</span></div>
        <Nav admin={user.role === "admin"} />
      </aside>
      <div className="main">
        <div className="top noprint justify-end">
          <Link href="/book" className="btn primary btn-icon"><Icon name="plus" />New booking</Link>
          <form action={logout} className="chip">
            <span className="chip-avatar" aria-hidden="true">{initials}</span>
            <span className="chip-who">{user.name}<small>{user.role === "admin" ? "Admin" : sector}</small></span>
            <button className="chip-out">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              Sign out
            </button>
          </form>
        </div>
        {children}
        {modal}
        <TrackPage />
      </div>
      <NavProgress />
    </div>
  );
}
