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
      <span className="pill">Free</span>{picked && <span className="pill picked">✓ Your choice</span>}
      <span className="pill pending">Waiting for payment</span>
      <span className="pill confirmed">Booked</span><span className="pill block">Closed / Miqaat</span>
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
      const on = p.picked?.(venueId, date, slot);
      const cls = `pill${on ? " picked" : ""}`;
      const text = on ? `✓ ${label}` : label;
      return p.freeHref ? <Link key={id} className={cls} href={p.freeHref(venueId, date, slot)}>{text}</Link> : <span key={id} className={cls}>{text}</span>;
    }
    const cls = `pill ${l.status}${p.dim?.(l) ? " other" : ""}${p.sel === id ? " sel" : ""}`;
    const title = l.status === "pending" ? "Waiting for payment" : l.status === "confirmed" ? "Booked" : "Closed";
    return p.takenHref ? <Link key={id} className={cls} href={p.takenHref(id)} title={title}>{label}</Link> : <span key={id} className={cls} title={title}>{label}</span>;
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
            {p.days.map((d) => <td key={d}>{v.type === "hall" ? [pill(v.id, d, "M", "Morning"), pill(v.id, d, "E", "Evening")] : pill(v.id, d, "D", "Full day")}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
