import Link from "next/link";
import { Calendar, Legend, loadWeek } from "@/lib/calendar";
import { getHouseholds, getSectors, getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { displayStatus, dmy, SLOT_LABEL, today } from "@/lib/format";
import type { AppUser, Booking } from "@/lib/types";
import { Badge } from "@/lib/ui";

export async function SectorDashboard({ user }: { user: AppUser }) {
  const t = today();
  const [bookings, households, crs, venues, week, sectors] = await Promise.all([
    db.collection("bookings").where("sectorId", "==", user.sectorId).get().then(rows<Booking>),
    getHouseholds(user.sectorId!),
    db.collection("cancellations").where("sectorId", "==", user.sectorId).get(),
    getVenues(),
    loadWeek(t),
    getSectors(),
  ]);
  const shown = bookings.map((b) => ({ ...b, shown: displayStatus(b) }));
  const upcoming = shown.filter((b) => ["Confirmed", "On hold", "Cancellation requested"].includes(b.shown) && b.items.at(-1)!.date >= t).sort((a, b) => a.items[0].date.localeCompare(b.items[0].date));
  const sectorName = sectors.find((x) => x.id === user.sectorId)?.name;
  const stat = (label: string, value: number, href: string) => (
    <div className="card"><div className="muted">{label}</div><div className="stat">{value}</div><Link href={href}>View</Link></div>
  );

  return (
    <>
      <div className="top"><h1>Dashboard{sectorName && ` · ${sectorName}`}</h1></div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        {stat("Upcoming bookings", upcoming.filter((b) => b.shown !== "On hold").length, "/my-bookings?status=Confirmed")}
        {stat("Awaiting payment", shown.filter((b) => b.shown === "On hold").length, "/my-bookings?status=On+hold")}
        {stat("Cancellation requests", crs.docs.filter((d) => d.data().status === "awaiting").length, "/cancellations")}
        {stat("Households", households.length, "/households")}
      </div>
      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>My upcoming bookings</h2>
          <table>
            <thead><tr><th>Booking</th><th>Household</th><th>Venue</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
            <tbody>
              {upcoming.slice(0, 10).map((b) => {
                const dates = [...new Set(b.items.map((i) => i.date))];
                return (
                  <tr key={b.id}>
                    <td><Link href={`/bookings/${b.id}`}>{b.no}</Link></td>
                    <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                    <td>{[...new Set(b.items.map((i) => i.venueName))].join(" + ")}</td>
                    <td>{dates.length > 1 ? `${dmy(dates[0])} – ${dmy(dates.at(-1))}` : dmy(dates[0])}</td>
                    <td>{SLOT_LABEL[b.items[0].slot]}{dates.length > 1 && ` × ${dates.length}`}</td>
                    <td><Badge s={b.shown} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Quick actions</h2>
          <div className="row">
            <Link className="btn primary" href="/book">New booking</Link>
            <Link className="btn" href="/households">Add household</Link>
            <Link className="btn" href="/my-bookings">My bookings</Link>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>This week</h2>
        <Legend />
        <Calendar venues={venues.filter((v) => v.active)} days={week.days} locks={week.locks} />
        <div className="note">The shared calendar shows bookings from every Sector / Mohalla. <Link href="/bookings">Check availability</Link></div>
      </div>
    </>
  );
}
