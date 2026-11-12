import Link from "next/link";
import { maxThaal, roomType } from "@/lib/booking";
import { inr } from "@/lib/format";
import { Icon } from "@/lib/icons";
import type { Lock, Slot, Venue } from "@/lib/types";


/** Rooms booked like a hotel: one card per room type with "− n +". Plus takes the next free room of that type, minus drops the last one added. */
export function RoomTypes(p: {
  rooms: Venue[];
  date: string;
  locks: Map<string, Lock>;
  inCart: (venueId: string) => boolean;
  toggleHref: (venueId: string) => string;
}) {
  const types = [...new Set(p.rooms.map(roomType))].map((name) => {
    const rooms = p.rooms.filter((v) => roomType(v) === name);
    const free = rooms.filter((v) => !p.locks.has(`${v.id}_${p.date}_D`));
    return { name, rooms, picked: free.filter((v) => p.inCart(v.id)), open: free.filter((v) => !p.inCart(v.id)) };
  }).sort((a, b) => (b.rooms[0].rates.perDay ?? 0) - (a.rooms[0].rates.perDay ?? 0));
  return (
    <ul className="hall-list">
      {types.map((t) => {
        const r = t.rooms[0];
        return (
          <li key={t.name} className={`hall-row${t.picked.length ? " picked" : ""}`}>
            <div className="hall-info">
              <b>{t.name}</b>
              <span className="hall-facts">
                <span>{r.capacity} persons per room</span>
                <span>{inr(r.rates.perDay ?? 0)} / day</span>
                <span className={`tag${t.open.length ? " ac" : ""}`}>{t.open.length ? `${t.open.length} of ${t.rooms.length} free` : "None free"}</span>
              </span>
            </div>
            <div className="stepper" role="group" aria-label={`${t.name} rooms`}>
              {t.picked.length
                ? <Link prefetch={false} scroll={false} className="step-btn" href={p.toggleHref(t.picked.at(-1)!.id)} aria-label={`One less ${t.name}`}>−</Link>
                : <span className="step-btn off" aria-hidden="true">−</span>}
              <span className="qty-n" aria-live="polite" aria-label={`${t.picked.length} ${t.name} selected`}>{t.picked.length}</span>
              {t.open.length
                ? <Link prefetch={false} scroll={false} className="step-btn" href={p.toggleHref(t.open[0].id)} aria-label={`One more ${t.name}`}>+</Link>
                : <span className="step-btn off" aria-hidden="true">+</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const TAKEN ={ pending: "On hold", confirmed: "Booked", block: "Closed" } as const;
const NAME: Record<Slot, string> = { M: "Morning", E: "Evening", D: "Full day" };

/** One date's halls or rooms as cards with big Morning / Evening (rooms: Full day) buttons that say their own state. */
export function HallCards(p: {
  venues: Venue[];
  date: string;
  locks: Map<string, Lock>;
  inCart: (venueId: string, slot: Slot) => boolean;
  toggleHref: (venueId: string, slot: Slot) => string;
}) {
  return (
    <ul className="hall-list">
      {p.venues.map((v) => {
        const any = (v.type === "hall" ? (["M", "E"] as const) : (["D"] as const)).some((s) => p.inCart(v.id, s));
        return (
          <li key={v.id} className={`hall-row${any ? " picked" : ""}`}>
            <div className="hall-info">
              <b>{v.name}</b>
              <span className="hall-facts">
                {v.type === "hall" ? (
                  <>
                    <span className={`tag${v.ac ? " ac" : ""}`}>{v.ac ? "AC" : "Non-AC"}</span>
                    <span>Up to {maxThaal(v)} thaal</span>
                    <span>{inr(v.rates.morning ?? 0)} / session</span>
                  </>
                ) : (
                  <>
                    <span>{v.capacity} persons</span>
                    <span>{inr(v.rates.perDay ?? 0)} / day</span>
                  </>
                )}
              </span>
            </div>
            <div className="slot-btns">
              {(v.type === "hall" ? (["M", "E"] as const) : (["D"] as const)).map((s) => {
                const l = p.locks.get(`${v.id}_${p.date}_${s}`);
                const label = `${v.name} ${NAME[s]}`;
                if (l) return <span key={s} className="slot-btn taken" aria-label={`${label}: ${TAKEN[l.status]}`}><small>{NAME[s]}</small>{TAKEN[l.status]}</span>;
                const on = p.inCart(v.id, s);
                return (
                  <Link key={s} prefetch={false} scroll={false} href={p.toggleHref(v.id, s)} className={`slot-btn${on ? " on" : ""}`} aria-pressed={on} aria-label={`${label}: ${on ? "added, tap to remove" : "free, tap to add"}`}>
                    <small>{NAME[s]}</small>
                    {on ? <span className="slot-state"><Icon name="check" size={16} />Added</span> : <span className="slot-state">Add</span>}
                  </Link>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
