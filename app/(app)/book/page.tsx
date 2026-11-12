import Form from "next/form";
import Link from "next/link";
import { getHouseholds, getSectors, getVenues } from "@/lib/data";
import { Icon } from "@/lib/icons";
import { requireUser } from "@/lib/session";
import { Msg, Steps, type SP } from "@/lib/ui";
import { HouseholdCard } from "./household-card";
import { Purpose } from "./purpose";
import { HhSearchInput } from "./hh-search-input";
import { PURPOSES, type DayEvent, type Item } from "@/lib/types";
import { cartItems, parseDays } from "@/lib/cart";
import { CartFloat } from "./cart-float";
import { addDays } from "@/lib/calendar";
import { DateField } from "@/lib/date-field";
import { fmt, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";

/**
 * Steps 1–2 of a new booking: pick the household (ITS / HOF ID) first, then a date with its function and size.
 * Step 2 opens the halls picker for that date (/book/slots, a popup on soft navigation). Each further date comes back here,
 * since every date can be a different function and size.
 * URL: h = household, q = household search, d = date being entered, ev = details of dates already entered (lib/cart.ts parseDays), c = cart.
 */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  const { hijri, dmy } = await fmt();
  const user = await requireUser();
  const sp = await searchParams;
  const [households, sectors, venues] = await Promise.all([getHouseholds(user.role === "admin" ? undefined : user.sectorId!), getSectors(), getVenues()]);
  const hh = households.find((h) => h.id === sp.h);
  let days: DayEvent[] = [];
  try {
    days = parseDays(sp.ev ?? "");
  } catch {} // bad details: start the dates over
  let items: Item[] = [];
  try {
    items = cartItems(sp.c ?? "", venues);
  } catch {} // a bad cart shows nothing here; step 3 says what is wrong
  const date = dateToIso(sp.d ?? "");
  const day = days.find((x) => x.date === date); // editing a date already entered
  const purpose = sp.purpose ?? day?.purpose;
  const inList = purpose && PURPOSES.includes(purpose);

  // Details already entered ride along when the household is searched for or changed.
  const keep = Object.fromEntries(Object.entries({ d: sp.d, ev: sp.ev, c: sp.c }).filter(([, v]) => v)) as Record<string, string>;
  const here = (o: Record<string, string>) => `/book?${new URLSearchParams({ ...keep, ...o })}`;
  const term = (sp.q ?? "").toLowerCase();
  const matches = term ? households.filter((h) => `${h.hof} ${h.name} ${h.mobile}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name;

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={hh ? 2 : 1} />
      <Msg msg={sp.msg} />
      {!hh ? (
        <div className="card">
          <h2>Who is the booking for?</h2>
          <Form action="/book" className="hh-search">
            {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <label className="sr-only" htmlFor="hh-q">Search household by HOF ID, name or mobile</label>
            <HhSearchInput defaultValue={sp.q} />
            <button className="icon-btn primary" aria-label="Search" title="Search"><Icon name="search" /></button>
          </Form>
          <div className="hh-results">
            {matches.map((h) => <Link key={h.id} className="hh-pick" href={here({ h: h.id })}><HouseholdCard h={h} sector={sectorName(h.sectorId)} /></Link>)}
            {term && !matches.length && <p className="muted m0">No household matches “{sp.q}”.</p>}
            {!term && <p className="muted m0">Search, then tap the household to book for.</p>}
          </div>
          <Link className="btn mt-3 btn-icon" href={`/households?back=${encodeURIComponent(here({}))}`}><Icon name="userPlus" />New household</Link>
          <div className="step-nav">
            <Link className="btn btn-icon" href="/"><Icon name="back" />Cancel</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <h2>Booking for</h2>
            <div className="hh-pick on">
              <HouseholdCard h={hh} sector={sectorName(hh.sectorId)} />
              <Link className="icon-btn" href={here({})} aria-label="Change household" title="Change household"><Icon name="pencil" /></Link>
            </div>
          </div>
          <div className="card">
            <h2>{day ? "Change this date" : days.length ? "Add another date" : "Date & function"}</h2>
            {/* Purpose fields post with form="book" (see purpose.tsx). */}
            <Form id="book" action="/book/slots" className="stack">
              <input type="hidden" name="h" value={hh.id} />
              {sp.c && <input type="hidden" name="c" value={sp.c} />}
              {sp.ev && <input type="hidden" name="ev" value={sp.ev} />}
              <label className="date-one"><span>Date <span className="req" aria-hidden="true">*</span></span><DateField hijri={hijri} name="d" required defaultValue={date >= today() ? date : days.length ? addDays(days.at(-1)!.date, 1) : today()} /></label>
              <Purpose options={PURPOSES} initial={!purpose ? "Wedding" : inList ? purpose : "Other"} initialOther={sp.purposeOther ?? (inList ? "" : purpose ?? "")} />
              <div>
                <div className="row">
                  <label>No. of thaal<input name="th" type="number" inputMode="numeric" min={1} step={1} defaultValue={sp.th ?? (day?.thaal || "")} /></label>
                  <label>No. of guests<input name="g" type="number" inputMode="numeric" min={1} step={1} defaultValue={sp.g ?? (day?.guests || "")} /></label>
                </div>
                <p className="muted m0">Enter thaal, guests or both. Halls that fit are shown first on the next step.</p>
              </div>
              <div className="step-nav">
                {days.length
                  ? <Link className="btn btn-icon" href={`/book/slots?${new URLSearchParams({ h: hh.id, ev: sp.ev ?? "", c: sp.c ?? "", d: days.at(-1)!.date })}`}><Icon name="back" />Back to cart</Link>
                  : <Link className="btn btn-icon" href={here({})}><Icon name="back" />Back</Link>}
                <button className="btn primary btn-icon">Next: pick halls<Icon name="next" /></button>
              </div>
            </Form>
          </div>
          {days.length > 0 && <CartFloat items={items} days={days} dmy={dmy} href={`/book/slots?${new URLSearchParams({ h: hh.id, ev: sp.ev ?? "", c: sp.c ?? "", d: days.at(-1)!.date })}`} />}
        </>
      )}
    </>
  );
}
