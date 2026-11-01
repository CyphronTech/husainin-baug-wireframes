import Link from "next/link";
import { thaalLimit } from "@/lib/booking";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { cartItems, toCart, toggleSlot } from "@/lib/cart";
import { DateField } from "@/lib/date-field";
import { getVenues } from "@/lib/data";
import { fmt, inr, SLOT_LABEL, today } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Item, Slot } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";

const MAX_DAYS_SHOWN = 60; // loadWeek's datesBetween cap

/** Wizard state lives in the URL: c (cart, see lib/cart.ts), from + to (days shown), hall (calendar filter), th (no. of thaal). */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  const { hijri, dmy } = await fmt();
  await requireUser();
  const sp = await searchParams;
  const from = sp.from && sp.from > today() ? sp.from : today();
  const lastDay = addDays(from, MAX_DAYS_SHOWN - 1);
  const wanted = sp.to && sp.to >= from ? sp.to : addDays(from, 6);
  const to = wanted > lastDay ? lastDay : wanted;

  const [allVenues, { days, locks }] = await Promise.all([getVenues(), loadWeek(from, to)]);
  const active = allVenues.filter((v) => v.active);
  const shown = active.filter((v) => !sp.hall || v.id === sp.hall);
  let items: Item[] = [];
  let error = wanted > lastDay ? `Showing the first ${MAX_DAYS_SHOWN} days. Use Next for the rest.` : "";
  try {
    items = cartItems(sp.c ?? "", allVenues);
  } catch (e) {
    error = (e as Error).message; // a bad cart starts over
  }
  const selected = active.filter((v) => items.some((i) => i.venueId === v.id));

  const state = { from, to, ...(sp.hall && { hall: sp.hall }), ...(sp.th && { th: sp.th }), c: toCart(items) };
  const href = (o: Record<string, string>) => `/book?${new URLSearchParams({ ...state, ...o })}`;
  const limit = thaalLimit(selected);
  const overLimit = limit > 0 && Number(sp.th) > limit;
  const total = items.reduce((a, i) => a + i.rate, 0);
  const isPicked = (v: string, d: string, s: Slot) => items.some((i) => i.venueId === v && i.date === d && (i.slot === s || i.slot === "D"));

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={1} />
      <Msg msg={sp.msg || error} />
      <div className="card">
        <h2>Search</h2>
        <form className="row">
          <input type="hidden" name="c" value={state.c} />
          <label>From date<DateField hijri={hijri} name="from" defaultValue={from} /></label>
          <label>To date<DateField hijri={hijri} name="to" defaultValue={to} /></label>
          <label>Hall<select name="hall" defaultValue={sp.hall}><option value="">All halls &amp; rooms</option>{active.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label>No. of thaal<input name="th" type="number" min={1} defaultValue={sp.th} /></label>
          <button className="btn">Search</button>
        </form>
      </div>

      <div className="card">
        <div className="top mb-2">
          <h2 className="m0">Add slots to your cart</h2>
          <span>
            <a className="btn" href="#cart">Cart ({items.length}) · {inr(total)}</a>{" "}
            {from > today() && <Link prefetch={false} className="btn" href={href({ from: addDays(from, -days.length), to: addDays(to, -days.length) })}>← Previous</Link>}{" "}
            <Link prefetch={false} className="btn" href={href({ from: addDays(from, days.length), to: addDays(to, days.length) })}>Next →</Link>
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

      <div className="card stack" id="cart">
        <h2>Your cart</h2>
        {!items.length && <p className="muted m0">Empty. Click a free slot in the calendar to add it.</p>}
        {items.length > 0 && (
          <table>
            <thead><tr><th>Venue</th><th>Date</th><th>Slot</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
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
              <tr><td colSpan={3}><b>Total</b></td><td><b>{inr(total)}</b></td><td><Link prefetch={false} scroll={false} href={href({ c: "" })}>Empty cart</Link></td></tr>
            </tbody>
          </table>
        )}
        <p className="alert info">The whole cart is one booking with one payment link. If any line is taken at checkout, nothing is booked. Slots are held only after checkout.</p>
        {overLimit && <p className="alert warn">Halls in your cart hold up to {limit} thaal, you entered {sp.th}. Add another hall or lower the number.</p>}
        <div>{items.length > 0 && !overLimit && <Link className="btn primary" href={`/book/review?${new URLSearchParams({ c: state.c, from, to, ...(sp.th && { th: sp.th }) })}`}>Checkout</Link>}</div>
      </div>
    </>
  );
}
