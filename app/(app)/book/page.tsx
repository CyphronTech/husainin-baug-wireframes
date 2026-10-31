import Link from "next/link";
import { priceItems } from "@/lib/booking";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { getVenues } from "@/lib/data";
import { dmy, inr, SLOT_LABEL, today } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Slot } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";

/** Wizard state lives in the URL: t (D/M/E/X = multiple days), from, to, vt (venue type), v (venue ids). */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const t = sp.t ?? "D";
  const from = sp.from || today();
  const to = t === "X" ? sp.to || from : from;
  const picked = (sp.v ?? "").split(",").filter(Boolean);
  const slot: Slot = t === "X" ? "D" : (t as Slot);

  const [allVenues, { days, locks }] = await Promise.all([getVenues(), loadWeek(from)]);
  const active = allVenues.filter((v) => v.active);
  const shown = active.filter((v) => !sp.vt || v.type === sp.vt);
  const selected = active.filter((v) => picked.includes(v.id));
  let items: ReturnType<typeof priceItems> = [];
  let error = "";
  try {
    items = selected.length ? priceItems(selected, from, to, slot) : [];
  } catch (e) {
    error = (e as Error).message;
  }

  const state = { t, from, to, ...(sp.vt && { vt: sp.vt }), v: picked.join(",") };
  const href = (o: Record<string, string>) => `/book?${new URLSearchParams({ ...state, ...o })}`;
  const inRange = (d: string) => d >= from && d <= to;
  // Clicking a free slot picks that venue; on a new date (single-day types) it starts a fresh selection.
  const freeHref = (venueId: string, date: string, s: Slot) => {
    const sameDate = t === "X" || date === from;
    const v = sameDate ? [...new Set([...picked, venueId])] : [venueId];
    const nt = s === "D" || t === "D" || t === "X" ? t : s;
    return href({ t: nt, from: t === "X" ? from : date, to: t === "X" ? to : date, v: v.join(",") });
  };

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={1} />
      <Msg msg={sp.msg || error} />
      <div className="card">
        <h2>Search</h2>
        <form className="row">
          <input type="hidden" name="v" value={state.v} />
          <label>Booking type<select name="t" defaultValue={t}><option value="D">Full day</option><option value="M">Morning slot</option><option value="E">Evening slot</option><option value="X">Multiple days</option></select></label>
          <label>From date<input type="date" name="from" defaultValue={from} /></label>
          <label>To date (multiple days)<input type="date" name="to" defaultValue={to} /></label>
          <label>Venue type<select name="vt" defaultValue={sp.vt}><option value="">Halls &amp; rooms</option><option value="hall">Halls</option><option value="room">Rooms</option></select></label>
          <button className="btn">Search</button>
        </form>
      </div>

      <div className="card">
        <div className="top mb-2">
          <h2 className="m0">Pick venues and slots</h2>
          <span><Link prefetch={false} className="btn" href={href({ from: addDays(from, -7), to: addDays(to, -7), v: "" })}>← Prev week</Link> <Link prefetch={false} className="btn" href={href({ from: addDays(from, 7), to: addDays(to, 7), v: "" })}>Next week →</Link></span>
        </div>
        <Legend picked />
        <Calendar
          venues={shown}
          days={days}
          locks={locks}
          freeHref={freeHref}
          picked={(v, d, s) => picked.includes(v) && inRange(d) && (s === "D" || slot === "D" || s === slot)}
        />
      </div>

      <div className="card stack">
        <h2>Your selection</h2>
        {!items.length && <p className="muted m0">Click a free slot in the calendar.</p>}
        {selected.map((v) => {
          const vi = items.filter((i) => i.venueId === v.id);
          if (!vi.length) return null;
          const s = vi[0].slot;
          return (
            <div key={v.id}>
              <b>{v.name}</b> · {from === to ? dmy(from) : `${dmy(from)} to ${dmy(to)}`} ·{" "}
              {SLOT_LABEL[s]}{v.type === "hall" && s === "D" && " (Morning + Evening)"} · {inr(vi.reduce((a, i) => a + i.rate, 0))}{" "}
              <Link href={href({ v: picked.filter((x) => x !== v.id).join(",") })}>Remove</Link>
            </div>
          );
        })}
        <form className="row">
          {Object.entries(state).filter(([k]) => k !== "v").map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
          <label>+ Add another hall or room
            <select name="v" required defaultValue="">
              <option value="" disabled>Select…</option>
              {active.filter((v) => !picked.includes(v.id)).map((v) => <option key={v.id} value={[...picked, v.id].join(",")}>{v.name}</option>)}
            </select>
          </label>
          <button className="btn">Add</button>
        </form>
        <p className="alert info">For large gatherings, add several halls and rooms. If any one is taken, the booking is not created.</p>
        <div>{items.length > 0 && <Link className="btn primary" href={`/book/review?${new URLSearchParams(state)}`}>Continue</Link>}</div>
      </div>
    </>
  );
}
