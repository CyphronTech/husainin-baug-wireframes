import Link from "next/link";
import { datesBetween, isLive } from "@/lib/booking";
import { getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { addDays } from "@/lib/calendar";
import { fmt, inr, istMidnight, slotSummary, today } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Block, Booking, Lock } from "@/lib/types";
import { Badge } from "@/lib/ui";
import { SectorDashboard } from "./sector-dashboard";

export default async function Dashboard() {
  const { dmy } = await fmt();
  const user = await requireUser();
  if (user.role !== "admin") return <SectorDashboard user={user} />;

  const t = today();
  const monthStart = t.slice(0, 8) + "01";
  const monthDays = datesBetween(monthStart, new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7), 0)).toISOString().slice(0, 10));
  const in7 = addDays(t, 6);

  const [venues, monthLocks, upcomingLocks, paid, pendingCr, blocks] = await Promise.all([
    getVenues(),
    db.collection("locks").where("date", ">=", monthStart).where("date", "<=", monthDays.at(-1)).get(),
    db.collection("locks").where("date", ">=", t).where("date", "<=", in7).get(),
    db.collection("bookings").where("payment.paidAt", ">=", istMidnight(monthStart)).get(),
    db.collection("cancellations").where("status", "==", "awaiting").count().get(),
    db.collection("blocks").where("to", ">=", t).get(),
  ]);

  const ml = monthLocks.docs.map((d) => d.data() as Lock).filter((l) => l.kind === "booking" && isLive(l));
  const ul = upcomingLocks.docs.map((d) => d.data() as Lock).filter((l) => l.kind === "booking" && isLive(l));
  const upcomingIds = [...new Set(ul.map((l) => l.refId))];
  const upcoming = upcomingIds.length
    ? (await db.getAll(...upcomingIds.map((id) => db.doc(`bookings/${id}`)))).map((d) => ({ id: d.id, ...d.data() }) as Booking).sort((a, b) => a.items[0].date.localeCompare(b.items[0].date))
    : [];
  const collected = rows<Booking>(paid).filter((b) => b.status === "confirmed").reduce((s, b) => s + b.amount, 0);
  const miqaats = rows<Block>(blocks).filter((b) => b.kind === "miqaat").sort((a, b) => a.from.localeCompare(b.from));
  const vName = (id: string) => venues.find((v) => v.id === id)?.name ?? id;

  return (
    <>
      <div className="top"><h1>Admin dashboard</h1></div>
      <div className="grid g4 mb-5">
        <div className="card"><div className="muted">Bookings this month</div><div className="stat">{new Set(ml.map((l) => l.refId)).size}</div></div>
        <div className="card"><div className="muted">Upcoming events (next 7 days)</div><div className="stat">{upcomingIds.length}</div></div>
        <div className="card"><div className="muted">Collections this month</div><div className="stat">{inr(collected)}</div><Link href="/payments">View</Link></div>
        <div className="card"><div className="muted">Pending cancellation approvals</div><div className="stat">{pendingCr.data().count}</div><Link href="/cancellations">View</Link></div>
      </div>

      <div className="grid g2 mb-5">
        <div className="card">
          <h2>Upcoming bookings</h2>
          <table>
            <thead><tr><th>Date</th><th>Venue</th><th>Slot</th><th>Household</th><th>Sector / Mohalla</th><th>Status</th></tr></thead>
            <tbody>
              {upcoming.map((b) => (
                <tr key={b.id}>
                  <td>{dmy(b.items[0].date)}</td>
                  <td><Link href={`/bookings/${b.id}`}>{[...new Set(b.items.map((i) => i.venueName))].join(", ")}</Link></td>
                  <td>{slotSummary(b.items)}</td>
                  <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                  <td>{b.sectorName}</td>
                  <td><Badge s={b.status === "pending" ? "On hold" : b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Occupancy this month</h2>
          {venues.filter((v) => v.active).map((v) => {
            const total = monthDays.length * (v.type === "hall" ? 2 : 1);
            const pct = Math.round((ml.filter((l) => l.venueId === v.id).length / total) * 100);
            return (
              <div key={v.id} className="occ">
                <span>{v.name}</span>
                <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                <span className="muted">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid g2e">
        <div className="card">
          <h2>Upcoming Miqaat blocks</h2>
          <table>
            <thead><tr><th>Miqaat</th><th>Dates</th><th>Venues blocked</th></tr></thead>
            <tbody>{miqaats.map((m) => <tr key={m.id}><td>{m.name}</td><td>{dmy(m.from)}{m.to !== m.from && ` – ${dmy(m.to)}`}</td><td>{m.venueIds.map(vName).join(", ")}</td></tr>)}</tbody>
          </table>
          <p><Link href="/miqaats">Manage Miqaat details</Link></p>
        </div>
        <div className="card">
          <h2>Quick actions</h2>
          <div className="row">
            <Link className="btn primary" href="/book">New booking</Link>
            <Link className="btn" href="/venues#block">Block dates</Link>
            <Link className="btn" href="/users">Add user</Link>
            <Link className="btn" href="/cancellations">Review cancellations</Link>
          </div>
        </div>
      </div>
    </>
  );
}
