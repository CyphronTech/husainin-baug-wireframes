import Link from "next/link";
import { datesBetween, isLive, maxThaal } from "./booking";
import { db } from "./firebase-admin";
import { fmt, SLOT_LABEL, toISODate } from "./format";
import { misri, MISRI_MONTHS } from "./misri";
import type { Lock, Slot, Venue } from "./types";

export const addDays = (iso: string, n: number) => toISODate(new Date(new Date(iso + "T00:00:00Z").getTime() + n * 864e5));

/** `start` to `end` (7 days by default), with only live locks (lapsed holds dropped). */
export async function loadWeek(start: string, end = addDays(start, 6)) {
  const days = datesBetween(start, end);
  const snap = await db.collection("locks").where("date", ">=", days[0]).where("date", "<=", days.at(-1)!).get();
  const now = new Date().toISOString();
  return { days, locks: new Map(snap.docs.map((d) => [d.id, d.data() as Lock]).filter(([, l]) => isLive(l as Lock, now)) as [string, Lock][]) };
}

/** Colour key: a small swatch styled like the slot it stands for, then its name. */
export function Legend({ cart }: { cart?: boolean }) {
  const keys: [string, string][] = [...(cart ? [["incart", "In cart"]] as [string, string][] : []), ["", "Available"], ["pending", "On hold (payment pending)"], ["confirmed", "Booked"], ["block", "Unavailable / Miqaat"]];
  return (
    <div className="legend">
      {keys.map(([cls, label]) => <span key={label} className="lg"><i className={`pill ${cls}`} aria-hidden="true" />{label}</span>)}
    </div>
  );
}

export async function Calendar(p: {
  venues: Venue[];
  days: string[];
  locks: Map<string, Lock>;
  freeHref?: (venueId: string, date: string, slot: Slot) => string;
  takenHref?: (lockId: string) => string;
  inCart?: (venueId: string, date: string, slot: Slot) => boolean;
  dim?: (l: Lock) => boolean;
  sel?: string;
  keepScroll?: boolean;
  removeHref?: (venueId: string) => string | undefined;
}) {
  const { hijri, dmy } = await fmt();
  const STATUS = { pending: "on hold", confirmed: "booked", block: "unavailable" } as const;
  const pill = (venueName: string, venueId: string, date: string, slot: Slot, label: string) => {
    const id = `${venueId}_${date}_${slot}`;
    const l = p.locks.get(id);
    const inCart = !l && p.inCart?.(venueId, date, slot);
    const desc = `${venueName}, ${dmy(date)}, ${SLOT_LABEL[slot]}, ${l ? STATUS[l.status] : inCart ? "in cart" : "available"}`;
    const a11y = { "aria-label": desc, title: desc };
    if (!l) {
      const cls = `pill${inCart ? " incart" : ""}`;
      return p.freeHref ? <Link key={id} prefetch={false} scroll={!p.keepScroll} className={cls} href={p.freeHref(venueId, date, slot)} {...a11y}>{label}</Link> : <span key={id} className={cls} {...a11y}>{label}</span>;
    }
    const cls = `pill ${l.status}${p.dim?.(l) ? " other" : ""}${p.sel === id ? " sel" : ""}`;
    return p.takenHref ? <Link key={id} prefetch={false} className={cls} href={p.takenHref(id)} {...a11y}>{label}</Link> : <span key={id} className={cls} {...a11y}>{label}</span>;
  };
  const head = (d: string) => {
    const en = new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
    const h = misri(d);
    // Both calendars, the toggle's one on top.
    if (!hijri) return <span>{en}<div className="muted">{h.d} {MISRI_MONTHS[h.m - 1]} {h.y}</div></span>;
    return <span title={`${en} ${d.slice(0, 4)}`}>{en.split(" ")[0]} {h.d} {MISRI_MONTHS[h.m - 1]}<div className="muted">{h.y} · {en.split(" ").slice(1).join(" ")}</div></span>;
  };
  return (
    <table className="cal">
      <thead>
        <tr><th>Venue</th>{p.days.map((d) => <th key={d}>{head(d)}</th>)}{p.removeHref && <th><span className="sr-only">Remove</span></th>}</tr>
      </thead>
      <tbody>
        {p.venues.map((v) => (
          <tr key={v.id}>
            <td><b>{v.name}</b><div className="muted">{v.type === "hall" ? `Hall · max ${maxThaal(v)} thaal` : "Room"}</div></td>
            {p.days.map((d) => <td key={d}>{v.type === "hall" ? [pill(v.name, v.id, d, "M", "M"), pill(v.name, v.id, d, "E", "E")] : pill(v.name, v.id, d, "D", "Day")}</td>)}
            {p.removeHref && <td className="cal-end">{p.removeHref(v.id) && <Link prefetch={false} scroll={false} className="cal-remove" href={p.removeHref(v.id)!} aria-label={`Remove ${v.name} from the calendar`} title={`Remove ${v.name}`}>×</Link>}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
