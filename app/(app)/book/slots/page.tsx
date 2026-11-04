import Link from "next/link";
import { redirect } from "next/navigation";
import { thaalLimit } from "@/lib/booking";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { cartItems, toCart, toggleSlot } from "@/lib/cart";
import { getVenues } from "@/lib/data";
import { fmt, inr, SLOT_LABEL, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";
import { requireUser } from "@/lib/session";
import type { Item, Slot } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";
import { HallSelect } from "./hall-select";

const MAX_DAYS_SHOWN = 60; // loadWeek's datesBetween cap

/** Step 2: pick slots. State lives in the URL: s (selected, not yet added), c (cart, see lib/cart.ts), from + to (days shown), hall (calendar filter), th (no. of thaal). */
export default async function BookSlots({ searchParams }: { searchParams: SP }) {
  const { dmy } = await fmt();
  await requireUser();
  const sp = await searchParams;
  const thaal = Number(sp.th);
  if (!Number.isInteger(thaal) || thaal < 1) {
    redirect(`/book?${new URLSearchParams({ c: sp.c ?? "", from: sp.from ?? "", to: sp.to ?? "", hall: sp.hall ?? "", msg: "Enter the number of thaal" })}`);
  }
  const fromDate = dateToIso(sp.from ?? "");
  const from = fromDate > today() ? fromDate : today();
  const lastDay = addDays(from, MAX_DAYS_SHOWN - 1);
  const toDate = dateToIso(sp.to ?? "");
  const wanted = toDate >= from ? toDate : addDays(from, 6);
  const to = wanted > lastDay ? lastDay : wanted;

  const [allVenues, { days, locks }] = await Promise.all([getVenues(), loadWeek(from, to)]);
  const active = allVenues.filter((v) => v.active);
  const hall = active.find((v) => v.id === sp.hall)?.id ?? active[0]?.id ?? "";
  const shown = active.filter((v) => v.id === hall);
  let items: Item[] = [];
  let chosen: Item[] = [];
  let error = wanted > lastDay ? `Showing the first ${MAX_DAYS_SHOWN} days. Use Next for the rest.` : "";
  try {
    items = cartItems(sp.c ?? "", allVenues);
    chosen = cartItems(sp.s ?? "", allVenues);
  } catch (e) {
    error = (e as Error).message; // a bad cart starts over
  }
  const selected = active.filter((v) => items.some((i) => i.venueId === v.id));

  const state = { from, to, hall, th: String(thaal), c: toCart(items), s: toCart(chosen) };
  const hallOptions = active.map((v) => {
    const n = items.filter((i) => i.venueId === v.id).length;
    return { id: v.id, label: n ? `${v.name} (${n} in cart)` : v.name };
  });
  const href = (o: Record<string, string>) => `/book/slots?${new URLSearchParams({ ...state, ...o })}`;
  const limit = thaalLimit(selected);
  const overLimit = limit > 0 && thaal > limit;
  const total = items.reduce((a, i) => a + i.rate, 0);
  const has = (list: Item[], v: string, d: string, s: Slot) => list.some((i) => i.venueId === v && i.date === d && (i.slot === s || i.slot === "D"));

  return (
    <>
      <div className="top"><h1>Choose dates &amp; slots</h1></div>
      <Steps on={2} />
      <Msg msg={sp.msg || error} />
      <div className="card">
        <div className="top mb-2">
          <div className="row items-center">
            <HallSelect hall={hall} options={hallOptions} />
            <p className="m0"><b>{thaal} thaal</b> · <Link prefetch={false} href={`/book?${new URLSearchParams(state)}`}>Change details</Link></p>
          </div>
          <span>
            {from > today() && <Link prefetch={false} scroll={false} className="btn" href={href({ from: addDays(from, -days.length), to: addDays(to, -days.length) })}>← Previous</Link>}{" "}
            <Link prefetch={false} scroll={false} className="btn" href={href({ from: addDays(from, days.length), to: addDays(to, days.length) })}>Next →</Link>
          </span>
        </div>
        <Legend picked cart />
        <Calendar
          venues={shown}
          days={days}
          locks={locks}
          freeHref={(v, d, s) => (has(items, v, d, s) ? href({ c: toggleSlot(items, v, d, s) }) : href({ s: toggleSlot(chosen, v, d, s) }))}
          picked={(v, d, s) => has(chosen, v, d, s)}
          inCart={(v, d, s) => has(items, v, d, s)}
          keepScroll
        />
        <div className="row justify-end mt-3">
          {chosen.length > 0
            ? <Link prefetch={false} scroll={false} className="btn primary" href={href({ c: toCart([...items, ...chosen]), s: "" })}>Add to cart ({chosen.length})</Link>
            : <button type="button" className="btn primary" disabled>Add to cart</button>}
        </div>
      </div>

      {items.length > 0 && (
        <div className="card stack">
          <h2>Your cart</h2>
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
          <p className="alert info">The whole cart is one booking with one payment link. If any line is taken at checkout, nothing is booked. Slots are held only after checkout.</p>
        </div>
      )}

      {overLimit && <p className="alert warn mb-3">Halls in your cart hold up to {limit} thaal, you entered {thaal}. Add another hall or lower the number.</p>}
      <div className="card checkoutbar">
        {items.length ? <b>{items.length} {items.length === 1 ? "line" : "lines"} · {inr(total)}</b> : <span className="muted">Select free slots in the calendar, then add them to the cart.</span>}
        {chosen.length > 0 && items.length > 0 && <span className="muted">Add your selected slots to the cart before checkout.</span>}
        {items.length > 0 && chosen.length === 0 && !overLimit && <Link className="btn primary" href={`/book/review?${new URLSearchParams({ c: state.c, from, to, hall, th: state.th })}`}>Checkout</Link>}
      </div>
    </>
  );
}
