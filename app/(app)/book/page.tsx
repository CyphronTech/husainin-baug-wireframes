import Link from "next/link";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { cartItems, toCart, toggleSlot } from "@/lib/cart";
import { DateField } from "@/lib/date-field";
import { getVenues } from "@/lib/data";
import { fmt, inr, SLOT_LABEL, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";
import { requireUser } from "@/lib/session";
import type { Item, Slot } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";

const MAX_DAYS_SHOWN = 60; // loadWeek's datesBetween cap

/** Step 1 — when & where. Wizard state lives in the URL: c (cart, see lib/cart.ts), from + to (days shown), hall (calendar filter). */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  const { hijri, dmy } = await fmt();
  await requireUser();
  const sp = await searchParams;
  const fromDate = dateToIso(sp.from ?? ""); // URL values: a bad date falls back
  const from = fromDate > today() ? fromDate : today();
  const lastDay = addDays(from, MAX_DAYS_SHOWN - 1);
  const toDate = dateToIso(sp.to ?? "");
  const wanted = toDate >= from ? toDate : addDays(from, 6);
  const to = wanted > lastDay ? lastDay : wanted;

  const [allVenues, { days, locks }] = await Promise.all([getVenues(), loadWeek(from, to)]);
  const active = allVenues.filter((v) => v.active);
  const shown = active.filter((v) => !sp.hall || v.id === sp.hall);
  let items: Item[] = [];
  let error = wanted > lastDay ? `Showing the first ${MAX_DAYS_SHOWN} days. Use Later for the rest.` : "";
  try {
    items = cartItems(sp.c ?? "", allVenues);
  } catch (e) {
    error = (e as Error).message; // a bad cart starts over
  }
  const selected = active.filter((v) => items.some((i) => i.venueId === v.id));

  const state = { from, to, ...(sp.hall && { hall: sp.hall }), c: toCart(items) };
  const href = (o: Record<string, string>) => `/book?${new URLSearchParams({ ...state, ...o })}`;
  const total = items.reduce((a, i) => a + i.rate, 0);
  const isPicked = (v: string, d: string, s: Slot) => items.some((i) => i.venueId === v && i.date === d && (i.slot === s || i.slot === "D"));

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={1} />
      <Msg msg={sp.msg || error} />

      <div className="card">
        <form className="row">
          <input type="hidden" name="c" value={state.c} />
          {sp.hall && <input type="hidden" name="hall" value={sp.hall} />}
          <label>Show dates from<DateField hijri={hijri} name="from" defaultValue={from} /></label>
          <button className="btn">Show</button>
        </form>
        <details className="filter mt-3" open={!!sp.hall}>
          <summary>Show only one hall or room</summary>
          <div className="toggles">
            {[{ id: "", name: "All" }, ...active].map((v) => (
              <Link key={v.id} prefetch={false} className={`toggle${(sp.hall ?? "") === v.id ? " on" : ""}`} href={v.id ? href({ hall: v.id }) : `/book?${new URLSearchParams({ from, to, c: state.c })}`}>{v.name}</Link>
            ))}
          </div>
        </details>
      </div>

      <div className="card">
        <div className="top mb-2">
          <h2 className="m0">Tap a free slot to add it</h2>
          <span className="row items-center">
            {from > today() && <Link prefetch={false} className="btn" href={href({ from: addDays(from, -days.length), to: addDays(to, -days.length) })}>‹ Earlier</Link>}
            <Link prefetch={false} className="btn" href={href({ from: addDays(from, days.length), to: addDays(to, days.length) })}>Later ›</Link>
          </span>
        </div>
        <Legend picked />
        <Calendar
          venues={shown}
          days={days}
          locks={locks}
          freeHref={(v, d, s) => href({ c: toggleSlot(items, v, d, s) })}
          picked={isPicked}
          keepScroll
        />
      </div>

      {items.length > 0 && (
        <div className="card stack" id="cart">
          <h2>You have chosen</h2>
          <table>
            <thead><tr><th>Hall / room</th><th>Date</th><th>Time</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.venueId + i.date}>
                  <td>{i.venueName}</td>
                  <td>{dmy(i.date)}</td>
                  <td>{SLOT_LABEL[i.slot]}{i.slot === "D" && selected.find((v) => v.id === i.venueId)?.type === "hall" && " (Morning + Evening)"}</td>
                  <td>{inr(i.rate)}</td>
                  <td><Link prefetch={false} scroll={false} href={href({ c: toCart(items.filter((x) => x !== i)) })}>Remove</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 1 && <p className="alert info">All of these are one booking with one payment. If any one is taken, nothing is booked.</p>}
        </div>
      )}

      <div className="sticky">
        {items.length ? (
          <>
            <div><b>{items.length} {items.length === 1 ? "slot" : "slots"} chosen · {inr(total)}</b>{items.length > 1 && <> · <a href="#cart">See list</a></>}</div>
            <Link className="btn primary big" href={`/book/who?${new URLSearchParams({ c: state.c, from, to })}`}>Continue →</Link>
          </>
        ) : (
          <span className="muted">Nothing chosen yet. Tap a free slot above.</span>
        )}
      </div>
    </>
  );
}
