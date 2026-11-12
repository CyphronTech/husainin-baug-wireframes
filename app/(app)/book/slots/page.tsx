import Link from "next/link";
import { redirect } from "next/navigation";
import { bookFromWizard } from "@/app/actions";
import { cartProblem, guestLimit, sizeProblem, thaalLimit } from "@/lib/booking";
import { loadWeek } from "@/lib/calendar";
import { HallCards, RoomTypes } from "./hall-cards";
import { cartItems, parseDays, setDay, toCart, toDays, toggleSlot } from "@/lib/cart";
import { getHouseholds, getVenues } from "@/lib/data";
import { fmt, inr, SLOT_LABEL, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";
import { requireUser } from "@/lib/session";
import { PURPOSES, type DayEvent, type Item, type Slot, type Venue } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";
import { Icon } from "@/lib/icons";
import { Submit } from "@/lib/submit";

const count = (x?: string) => (/^\d+$/.test(x ?? "") ? Number(x) : 0);
const sizeText = (x: DayEvent) => [x.thaal && `${x.thaal} thaal`, x.guests && `${x.guests} guests`].filter(Boolean).join(" and ");

/**
 * Step 3: tap the free slots of the halls and rooms for one date; they go to the cart. "Add another date" goes back to
 * step 2 for the next date's function and size. Then book.
 * State lives in the URL: h (household), d (date shown), ev (each date's function, lib/cart.ts parseDays), c (cart, lib/cart.ts).
 * Step 2 posts d with purpose/purposeOther/th/g, which are folded into ev here.
 */
export default async function BookSlots({ searchParams }: { searchParams: SP }) {
  const { dmy } = await fmt();
  const user = await requireUser();
  const sp = await searchParams;
  const d = dateToIso(sp.d ?? "");
  function back(msg: string, o: Record<string, string> = {}): never {
    redirect(`/book?${new URLSearchParams({ h: sp.h ?? "", ev: sp.ev ?? "", c: sp.c ?? "", d, ...o, ...(msg && { msg }) })}`);
  }
  if (!sp.h) back("");
  let days: DayEvent[] = [];
  try {
    days = parseDays(sp.ev ?? "");
  } catch {
    back("The function details were invalid. Enter them again", { ev: "" });
  }
  if (sp.purpose !== undefined) {
    // Just came from step 2: check what was entered for date d and add it to the dates.
    const kept = { purpose: sp.purpose, purposeOther: sp.purposeOther ?? "", th: sp.th ?? "", g: sp.g ?? "" };
    const purpose = sp.purpose === "Other" ? (sp.purposeOther ?? "").trim() : sp.purpose;
    const day = { date: d, purpose, thaal: count(sp.th), guests: count(sp.g) };
    const missing = d < today() ? "Pick today or a later date" : !purpose || !PURPOSES.includes(sp.purpose) ? "Choose what the function is" : purpose.length > 60 ? "Keep the function name under 60 letters" : !day.thaal && !day.guests ? "Enter the number of thaal or guests" : "";
    if (missing) back(missing, kept);
    days = setDay(days, day);
  }
  const day = days.find((x) => x.date === d);
  if (!day) back(""); // a date's function comes first (step 2)

  const [allVenues, { locks }, households] = await Promise.all([getVenues(), loadWeek(d, d), getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  const hh = households.find((x) => x.id === sp.h);
  if (!hh) redirect("/book");
  const active = allVenues.filter((v) => v.active);
  let items: Item[] = [];
  let error = "";
  try {
    items = cartItems(sp.c ?? "", allVenues);
  } catch (e) {
    error = (e as Error).message; // a bad cart starts over
  }

  const state = { h: hh.id, d, ev: toDays(days), c: toCart(items) };
  const href = (o: Record<string, string>) => `/book/slots?${new URLSearchParams({ ...state, ...o })}`;
  const step2 = (o: Record<string, string>) => `/book?${new URLSearchParams({ h: hh.id, ev: state.ev, c: state.c, ...o })}`;
  const dates = [...new Set([...items.map((i) => i.date), d])].sort();
  const problem = cartProblem(items, allVenues, days);
  // Size meter for the date shown: thaal when given, else guests, against that date's halls in the cart.
  const onDate = active.filter((v) => items.some((i) => i.date === d && i.venueId === v.id));
  const [unit, need, cap] = day.thaal ? (["Thaal", day.thaal, thaalLimit(onDate)] as const) : (["Guests", day.guests, guestLimit(onDate)] as const);

  const fits = (v: Venue) => !sizeProblem([v], day);
  const hallList = active.filter((v) => v.type === "hall");
  // Halls that hold the function alone come first, cheapest first; smaller ones after.
  const byPrice = (a: Venue, b: Venue) => (a.rates.morning ?? 0) - (b.rates.morning ?? 0);
  const groups = [
    { title: "Halls", venues: [...hallList.filter(fits).sort(byPrice), ...hallList.filter((v) => !fits(v)).sort(byPrice)] },
    { title: "Guest rooms", venues: active.filter((v) => v.type === "room") },
  ].filter((g) => g.venues.length);

  const total = items.reduce((a, i) => a + i.rate, 0);
  const has = (v: string, date: string, s: Slot) => items.some((i) => i.venueId === v && i.date === date && (i.slot === s || i.slot === "D"));
  const lines = `${items.length} ${items.length === 1 ? "slot" : "slots"}`;
  const typeOf = (id: string) => allVenues.find((v) => v.id === id)?.type;

  return (
    <>
      <div className="top"><h1>Choose halls</h1></div>
      <Steps on={3} />
      <Msg msg={sp.msg || error} />
      <div className="card slots">
        <div className="day-head">
          <div>
            <h2 className="m0">{dmy(d)}</h2>
            <p className="m0 muted">{day.purpose} · {sizeText(day)} · for {hh.name}</p>
          </div>
          <Link className="btn btn-icon" href={step2({ d })}><Icon name="pencil" />Change</Link>
        </div>
        {/* Only when the halls added are too small; nothing to say once they fit. */}
        {cap > 0 && cap < need && (
          <p className="cover" aria-live="polite">Halls added hold {cap} {unit.toLowerCase()}. Add more for {need - cap} more.</p>
        )}
        {groups.map((g) => (
          <section key={g.title} className="pick-group">
            {groups.length > 1 && <h3>{g.title}</h3>}
            {g.venues[0].type === "room"
              ? <RoomTypes rooms={g.venues} date={d} locks={locks} inCart={(v) => has(v, d, "D")} toggleHref={(v) => href({ c: toggleSlot(items, v, d, "D") })} />
              : <HallCards venues={g.venues} date={d} locks={locks} inCart={(v, s) => has(v, d, s)} toggleHref={(v, s) => href({ c: toggleSlot(items, v, d, s) })} />}
          </section>
        ))}
      </div>

      <div className="card cart">
        <div className="top mb-2">
          <h2 className="m0">Your cart</h2>
          {items.length > 0 && <Link prefetch={false} scroll={false} className="icon-btn danger" href={href({ c: "" })} aria-label="Empty cart" title="Empty cart"><Icon name="trash" /></Link>}
        </div>
        {dates.map((date) => {
          const ev = days.find((x) => x.date === date);
          const mine = items.filter((i) => i.date === date);
          return (
            <section key={date} className={`cart-day${date === d ? " on" : ""}`}>
              <h3>
                <Link prefetch={false} scroll={false} href={href({ d: date })}>{dmy(date)}</Link>
                <span className="muted">{ev ? `${ev.purpose} · ${sizeText(ev)}` : "Function not entered"}</span>
              </h3>
              {mine.length === 0 ? <p className="muted m0">No halls yet. Tap a free slot above.</p> : (
                <ul className="cart-list">
                  {mine.map((i) => (
                    <li key={i.venueId + i.date}>
                      <div>
                        <b>{i.venueName}</b>
                        <div className="muted">{SLOT_LABEL[i.slot]}{i.slot === "D" && typeOf(i.venueId) === "hall" && " (Morning + Evening)"}</div>
                      </div>
                      <span className="cart-rate">{inr(i.rate)}</span>
                      <Link prefetch={false} scroll={false} className="cal-remove" href={href({ c: toCart(items.filter((x) => x !== i)) })} aria-label={`Remove ${i.venueName}, ${dmy(i.date)} from the cart`} title="Remove">×</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        <Link className="btn btn-icon mt-3" href={step2({})}><Icon name="plus" />Add another date</Link>
        {problem && <p className="alert warn mb-3">{problem}. Add another hall on that date, or change its function.</p>}
        <form action={bookFromWizard} className="step-nav">
          {Object.entries(state).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <Link prefetch={false} className="btn btn-icon" href={step2({ d })}><Icon name="back" />Back</Link>
          {items.length > 0 && <span className="step-total"><b className="checkout-total">{inr(total)}</b><span className="muted">{lines} · {new Set(items.map((i) => i.date)).size} {new Set(items.map((i) => i.date)).size === 1 ? "date" : "dates"}</span></span>}
          {items.length > 0 && !problem
            ? <Submit className="btn primary btn-icon"><Icon name="send" />Book &amp; send link</Submit>
            : <button type="button" className="btn primary btn-icon" disabled><Icon name="send" />Book &amp; send link</button>}
        </form>
      </div>
    </>
  );
}
