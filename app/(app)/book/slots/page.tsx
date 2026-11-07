import Link from "next/link";
import { redirect } from "next/navigation";
import { maxThaal, thaalLimit } from "@/lib/booking";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { cartItems, toCart, toggleSlot } from "@/lib/cart";
import { getVenues } from "@/lib/data";
import { fmt, inr, SLOT_LABEL, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";
import { requireUser } from "@/lib/session";
import type { Item, Slot } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";
import { Icon } from "@/lib/icons";
import { AddVenue } from "./add-venue";
import { HallSelect } from "./hall-select";

const MAX_DAYS_SHOWN = 60; // loadWeek's datesBetween cap

/**
 * Step 2: pick slots. Tapping a free slot puts it straight in the cart; tapping it again takes it out.
 * State lives in the URL: c (cart, see lib/cart.ts), from + to (days shown), hall (calendar rows), th (no. of thaal).
 * s (slots selected under the old two-step flow) is merged into the cart so old links still work.
 */
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
  const halls = (sp.hall ?? "").split(",").filter((id) => active.some((v) => v.id === id));
  const hall = halls.join(",");
  const shown = active.filter((v) => halls.includes(v.id)); // no calendar until a hall or room is picked
  let items: Item[] = [];
  let error = wanted > lastDay ? `Showing the first ${MAX_DAYS_SHOWN} days. Go back to change the dates.` : "";
  try {
    items = cartItems([sp.c, sp.s].filter(Boolean).join(","), allVenues);
  } catch (e) {
    error = (e as Error).message; // a bad cart starts over
  }
  const selected = active.filter((v) => items.some((i) => i.venueId === v.id));

  const state = { from, to, hall, th: String(thaal), c: toCart(items) };
  const hallOptions = active.map((v) => ({ id: v.id, label: v.name }));
  const href = (o: Record<string, string>) => `/book/slots?${new URLSearchParams({ ...state, ...o })}`;
  const limit = thaalLimit(selected);
  const overLimit = limit > 0 && thaal > limit;
  // More thaal than the shown and cart halls hold together: let the user add another hall or room as a calendar row.
  const cap = thaalLimit([...new Set([...shown, ...selected])]);
  const addable = halls.length && thaal > cap
    ? active.filter((v) => !halls.includes(v.id)).map((v) => ({ href: href({ hall: [...halls, v.id].join(",") }), name: v.name, sub: v.type === "hall" ? `Hall · max ${maxThaal(v)} thaal` : "Room" }))
    : [];
  const total = items.reduce((a, i) => a + i.rate, 0);
  const has = (v: string, d: string, s: Slot) => items.some((i) => i.venueId === v && i.date === d && (i.slot === s || i.slot === "D"));
  const lines = `${items.length} ${items.length === 1 ? "slot" : "slots"}`;

  return (
    <>
      <div className="top"><h1>Choose dates &amp; slots</h1></div>
      <Steps on={2} />
      <Msg msg={sp.msg || error} />
      <div className="card slots">
        <div className="slots-bar">
          <HallSelect halls={halls} options={hallOptions} />
          <div className="slots-meta">
            <div className={`capmeter${cap && thaal > cap ? " short" : ""}`}>
              <span className="capmeter-label">Thaal</span>
              <span><b>{thaal}</b>{cap > 0 && <span className="muted"> / {cap} max</span>}</span>
              {cap > 0 && <span className="bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (thaal / cap) * 100)}%` }} /></span>}
            </div>
            {addable.length > 0 && <AddVenue options={addable} />}
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="slots-empty">
            <p className="slots-hint">Pick a hall or room to see its free slots.</p>
            <div className="venue-pick">
              {active.map((v) => (
                <Link key={v.id} prefetch={false} scroll={false} href={href({ hall: v.id })}>
                  <b>{v.name}</b><span className="muted">{v.type === "hall" ? `Hall · max ${maxThaal(v)} thaal` : "Room"}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <p className="slots-hint">Tap a free slot to add it to the cart. Tap it again to remove it. M = Morning, E = Evening.</p>
            <Legend cart />
            <Calendar
              venues={shown}
              days={days}
              locks={locks}
              freeHref={(v, d, s) => href({ c: toggleSlot(items, v, d, s) })}
              inCart={has}
              keepScroll
              removeHref={halls.length > 1 ? (id) => href({ hall: halls.filter((h) => h !== id).join(",") }) : undefined}
            />
          </>
        )}
      </div>

      <div className="card cart">
        <div className="top mb-2">
          <h2 className="m0">Your cart</h2>
          {items.length > 0 && <Link prefetch={false} scroll={false} className="icon-btn danger" href={href({ c: "" })} aria-label="Empty cart" title="Empty cart"><Icon name="trash" /></Link>}
        </div>
        {items.length === 0 ? <p className="muted">Empty. Tap a free slot in the calendar to add it.</p> : (
          <ul className="cart-list">
            {items.map((i) => (
              <li key={i.venueId + i.date}>
                <div>
                  <b>{i.venueName}</b>
                  <div className="muted">{dmy(i.date)} · {SLOT_LABEL[i.slot]}{i.slot === "D" && selected.find((v) => v.id === i.venueId)?.type === "hall" && " (Morning + Evening)"}</div>
                </div>
                <span className="cart-rate">{inr(i.rate)}</span>
                <Link prefetch={false} scroll={false} className="cal-remove" href={href({ c: toCart(items.filter((x) => x !== i)) })} aria-label={`Remove ${i.venueName}, ${dmy(i.date)} from the cart`} title="Remove">×</Link>
              </li>
            ))}
          </ul>
        )}
        {overLimit && <p className="alert warn mb-3">Halls in your cart hold up to {limit} thaal, you entered {thaal}. Add another hall, or go back and lower the number.</p>}
        <div className="step-nav">
          <Link prefetch={false} className="btn btn-icon" href={`/book?${new URLSearchParams(state)}`}><Icon name="back" />Back</Link>
          {items.length > 0 && <span className="step-total"><b className="checkout-total">{inr(total)}</b><span className="muted">{lines}</span></span>}
          {items.length > 0 && !overLimit
            ? <Link className="btn primary btn-icon" href={`/book/review?${new URLSearchParams({ c: state.c, from, to, hall, th: state.th })}`}>Next: household<Icon name="next" /></Link>
            : <button type="button" className="btn primary btn-icon" disabled>Next: household<Icon name="next" /></button>}
        </div>
      </div>
    </>
  );
}
