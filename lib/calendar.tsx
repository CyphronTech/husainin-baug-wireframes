import Link from "next/link";
import { datesBetween, isLive } from "./booking";
import { db } from "./firebase-admin";
import { toISODate } from "./format";
import type { Lock, Slot, Venue } from "./types";

export const addDays = (iso: string, n: number) => toISODate(new Date(new Date(iso + "T00:00:00Z").getTime() + n * 864e5));

/** 7 days from `start`, with only live locks (lapsed holds dropped). */
export async function loadWeek(start: string) {
  const days = datesBetween(start, addDays(start, 6));
  const snap = await db.collection("locks").where("date", ">=", days[0]).where("date", "<=", days[6]).get();
  const now = new Date().toISOString();
  return { days, locks: new Map(snap.docs.map((d) => [d.id, d.data() as Lock]).filter(([, l]) => isLive(l as Lock, now)) as [string, Lock][]) };
}

export function Legend({ picked }: { picked?: boolean }) {
  return (
    <div className="legend">
      {picked && <span className="pill picked">Selected</span>}
      <span className="pill">Available</span><span className="pill pending">On hold (payment pending)</span>
      <span className="pill confirmed">Booked</span><span className="pill block">Unavailable / Miqaat</span>
    </div>
  );
}

export function Calendar(p: {
  venues: Venue[];
  days: string[];
  locks: Map<string, Lock>;
  freeHref?: (venueId: string, date: string, slot: Slot) => string;
  takenHref?: (lockId: string) => string;
  picked?: (venueId: string, date: string, slot: Slot) => boolean;
  dim?: (l: Lock) => boolean;
  sel?: string;
}) {
  const pill = (venueId: string, date: string, slot: Slot, label: string) => {
    const id = `${venueId}_${date}_${slot}`;
    const l = p.locks.get(id);
    if (!l) {
      const cls = `pill${p.picked?.(venueId, date, slot) ? " picked" : ""}`;
      return p.freeHref ? <Link key={id} className={cls} href={p.freeHref(venueId, date, slot)}>{label}</Link> : <span key={id} className={cls}>{label}</span>;
    }
    const cls = `pill ${l.status}${p.dim?.(l) ? " other" : ""}${p.sel === id ? " sel" : ""}`;
    return p.takenHref ? <Link key={id} className={cls} href={p.takenHref(id)}>{label}</Link> : <span key={id} className={cls}>{label}</span>;
  };
  return (
    <table className="cal">
      <thead>
        <tr><th>Venue</th>{p.days.map((d) => <th key={d}>{new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })}</th>)}</tr>
      </thead>
      <tbody>
        {p.venues.map((v) => (
          <tr key={v.id}>
            <td><b>{v.name}</b><div className="muted">{v.type === "hall" ? "Hall" : "Room"}</div></td>
            {p.days.map((d) => <td key={d}>{v.type === "hall" ? [pill(v.id, d, "M", "M"), pill(v.id, d, "E", "E")] : pill(v.id, d, "D", "Day")}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
