import Link from "next/link";
import { redirect } from "next/navigation";
import { bookFromWizard } from "@/app/actions";
import { cartProblem, guestLimit, roomType, sizeProblem, thaalLimit } from "@/lib/booking";
import { addDays, loadWeek } from "@/lib/calendar";
import { HallCards, RoomTypes } from "./hall-cards";
import { FunctionForm } from "../function-form";
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
 * Step 2 (after the household): the date and function form on top, that session's halls and rooms below, the cart on the
 * right. The form posts back here (d, ss, purpose/purposeOther, th, g), is checked, and is folded into ev; tapping a free
 * hall puts it in the cart. "Add another date or session" clears the form for the next one. Then book.
 * State lives in the URL: h (household), d + ss (function shown), ev (every function, lib/cart.ts parseDays), c (cart, lib/cart.ts).
 */
export default async function BookSlots({ searchParams }: { searchParams: SP }) {
  const { dmy, hijri } = await fmt();
  const user = await requireUser();
  const sp = await searchParams;
  const d = dateToIso(sp.d ?? "");
  function back(msg: string, o: Record<string, string> = {}): never {
    redirect(`/book?${new URLSearchParams({ h: sp.h ?? "", ev: sp.ev ?? "", c: sp.c ?? "", ...o, ...(msg && { msg }) })}`);
  }
  if (!sp.h) back("");
  let days: DayEvent[] = [];
  try {
    days = parseDays(sp.ev ?? "");
  } catch {
    back("The function details were invalid. Enter them again", { ev: "" });
  }
  // The form above just posted: check it and add it to the functions. A problem keeps what was typed in the form.
  let formError = "";
  if (sp.purpose !== undefined) {
    const purpose = sp.purpose === "Other" ? (sp.purposeOther ?? "").trim() : sp.purpose;
    const entered = { date: d, slot: sp.ss === "E" ? "E" : ("M" as Slot), purpose, thaal: count(sp.th), guests: count(sp.g) };
    formError = !d || d < today() ? "Pick today or a later date" : !purpose || !PURPOSES.includes(sp.purpose) ? "Choose what the function is" : purpose.length > 60 ? "Keep the function name under 60 letters" : !entered.thaal && !entered.guests ? "Enter the number of thaal or guests" : "";
    if (!formError) days = setDay(days, entered);
  }
  // The function shown: the session asked for (ss), else the date's first one. None yet = form only, no halls.
  const day = d ? days.find((x) => x.date === d && (x.slot ?? "D") === sp.ss) ?? days.find((x) => x.date === d) : undefined;
  const ss = day?.slot ?? (sp.ss === "E" ? "E" : "M");
  const sessions: ("M" | "E")[] = ss === "D" ? ["M", "E"] : [ss];

  const [allVenues, week, households] = await Promise.all([getVenues(), day ? loadWeek(d, d) : null, getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  const locks = week?.locks ?? new Map();
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

  const state = { h: hh.id, d, ss, ev: toDays(days), c: toCart(items) };
  const href = (o: Record<string, string>) => `/book/slots?${new URLSearchParams({ ...state, ...o })}`;
  const dates = [...new Set([...items.map((i) => i.date), ...(day ? [d] : [])])].sort();
  const problem = cartProblem(items, allVenues, days);
  // Size check for the function shown: thaal when given, else guests, against the halls added for its session(s).
  // A whole-day function counts its smaller session, so neither morning nor evening is short.
  const limit = day?.thaal ? thaalLimit : guestLimit;
  const caps = sessions
    .map((s) => limit(active.filter((v) => items.some((i) => i.date === d && i.venueId === v.id && (i.slot === s || i.slot === "D")))))
    .filter(Boolean);
  const [unit, need, cap] = [day?.thaal ? "Thaal" : "Guests", day ? day.thaal || day.guests : 0, caps.length ? Math.min(...caps) : 0] as const;
  // Form above: what was just typed (after a problem), else the function shown, else a fresh one for the next day.
  const draft = formError
    ? { date: d || today(), session: ss === "E" ? "E" : "M", purpose: sp.purpose, purposeOther: sp.purposeOther, th: sp.th, g: sp.g }
    : day
      ? { date: day.date, session: ss === "E" ? "E" : "M", purpose: day.purpose, th: day.thaal, g: day.guests }
      : { date: d && d >= today() ? d : days.length ? addDays(days.at(-1)!.date, 1) : today(), session: ss === "E" ? "E" : "M" };

  const fits = (v: Venue) => !day || !sizeProblem([v], day);
  const free = (v: Venue, s: Slot) => !locks.has(`${v.id}_${d}_${s}`);
  const hallList = active.filter((v) => v.type === "hall");
  const roomList = active.filter((v) => v.type === "room");
  const hallOpen = (v: Venue) => sessions.some((s) => free(v, s)); // free for at least one session shown
  const typeFull = (v: Venue) => roomList.filter((r) => roomType(r) === roomType(v)).every((r) => !free(r, "D"));
  // Free halls that hold the function alone come first, cheapest first; smaller ones after. Anything taken goes last.
  const byPrice = (a: Venue, b: Venue) => (a.rates.morning ?? 0) - (b.rates.morning ?? 0);
  const openHalls = hallList.filter(hallOpen);
  const groups = [
    { title: "Halls", halls: [...openHalls.filter(fits).sort(byPrice), ...openHalls.filter((v) => !fits(v)).sort(byPrice)], rooms: [] as Venue[] },
    { title: "Guest rooms", halls: [] as Venue[], rooms: roomList.filter((v) => !typeFull(v)) },
    { title: "Not available on this date", halls: hallList.filter((v) => !hallOpen(v)).sort(byPrice), rooms: roomList.filter(typeFull) },
  ].filter((g) => g.halls.length || g.rooms.length);

  const total = items.reduce((a, i) => a + i.rate, 0);
  const has = (v: string, date: string, s: Slot) => items.some((i) => i.venueId === v && i.date === date && (i.slot === s || i.slot === "D"));
  const lines = `${items.length} ${items.length === 1 ? "slot" : "slots"}`;
  const typeOf = (id: string) => allVenues.find((v) => v.id === id)?.type;

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={2} />
      <Msg msg={sp.msg || formError || error} />
      {/* Date & function, then its halls on the left; the cart always open on the right (stacked on narrow screens). */}
      <div className="slots-grid">
      <div className="slots-main">
      <div className="card hh-strip">
        <span className="muted">Booking for</span> <b>{hh.name}</b> <span className="muted">· HOF {hh.hof}</span>
        <Link className="link btn-icon" href={`/book?${new URLSearchParams({ ev: state.ev, c: state.c })}`}><Icon name="pencil" size={16} />Change</Link>
      </div>
      <FunctionForm
        key={JSON.stringify(draft)} // the fields keep typed values across page updates; a new key resets them to this function
        hijri={hijri}
        hidden={{ h: hh.id, c: state.c, ev: state.ev }}
        heading={day || formError ? "Date & function" : days.length ? "Add another date or session" : "Date & function"}
        {...draft}
        session={draft.session as "M" | "E"}
        summary={day && !formError ? `${dmy(day.date)} · ${SLOT_LABEL[ss]} · ${day.purpose} · ${sizeText(day)}` : undefined}
      />
      {day && (
      <div className="card slots">
        <div className="day-head">
          <div>
            <h2 className="m0">Halls for {dmy(d)}</h2>
            <p className="m0 muted">{ss !== "D" && <b>{SLOT_LABEL[ss]} · </b>}{day.purpose} · {sizeText(day)}</p>
          </div>
        </div>
        {/* Only when the halls added are too small; nothing to say once they fit. */}
        {cap > 0 && cap < need && (
          <p className="cover" aria-live="polite">Halls added hold {cap} {unit.toLowerCase()}. Add more for {need - cap} more.</p>
        )}
        {groups.map((g) => (
          <section key={g.title} className={`pick-group${g.title.startsWith("Not") ? " off" : ""}`}>
            {groups.length > 1 && <h3>{g.title}</h3>}
            {g.halls.length > 0 && <HallCards venues={g.halls} date={d} sessions={sessions} locks={locks} inCart={(v, s) => has(v, d, s)} toggleHref={(v, s) => href({ c: toggleSlot(items, v, d, s) })} />}
            {g.rooms.length > 0 && <RoomTypes rooms={g.rooms} date={d} locks={locks} inCart={(v) => has(v, d, "D")} toggleHref={(v) => href({ c: toggleSlot(items, v, d, "D") })} />}
          </section>
        ))}
      </div>
      )}
      </div>

      <aside className="card cart-side" aria-labelledby="cart-title">
        <div className="top mb-2">
          <h2 className="m0" id="cart-title">Your cart</h2>
          {items.length > 0 && <Link prefetch={false} scroll={false} className="icon-btn danger" href={href({ c: "" })} aria-label="Empty cart" title="Empty cart"><Icon name="trash" /></Link>}
        </div>
        {dates.map((date) => {
          const evs = days.filter((x) => x.date === date);
          const mine = items.filter((i) => i.date === date);
          return (
            <section key={date} className={`cart-day${date === d ? " on" : ""}`}>
              <h3>
                <Link prefetch={false} scroll={false} href={href({ d: date, ss: "" })}>{dmy(date)}</Link>
                {evs.length ? evs.map((ev) => (
                  <Link key={ev.slot} prefetch={false} scroll={false} className="muted" href={href({ d: date, ss: ev.slot ?? "D" })}>
                    {(ev.slot ?? "D") !== "D" && `${SLOT_LABEL[ev.slot!]}: `}{ev.purpose} · {sizeText(ev)}
                  </Link>
                )) : <span className="muted">Function not entered</span>}
              </h3>
              {mine.length === 0 ? <p className="muted m0">No halls yet. Tap a hall to add it.</p> : (
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
        {days.length > 0 ? (
          <Link prefetch={false} scroll={false} className="btn btn-icon mt-3" href={`/book/slots?${new URLSearchParams({ h: hh.id, ev: state.ev, c: state.c })}`}><Icon name="plus" />Add another date or session</Link>
        ) : <p className="muted m0">Empty. Enter the date and function, then tap a hall.</p>}
        {problem && (
          <p className="alert warn mb-3">
            {problem.endsWith("enter what the function is")
              ? `${problem}: tap "Add another date or session" and pick that date and session.`
              : `${problem}. Add another hall for it, or change its function.`}
          </p>
        )}
        <form action={bookFromWizard} className="step-nav">
          {Object.entries(state).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {items.length > 0 && <span className="step-total"><b className="checkout-total">{inr(total)}</b><span className="muted">{lines} · {new Set(items.map((i) => i.date)).size} {new Set(items.map((i) => i.date)).size === 1 ? "date" : "dates"}</span></span>}
          <Link prefetch={false} className="btn btn-icon" href={`/book?${new URLSearchParams({ ev: state.ev, c: state.c })}`}><Icon name="back" />Back</Link>
          {items.length > 0 && !problem
            ? <Submit className="btn primary btn-icon"><Icon name="send" />Book &amp; send link</Submit>
            : <button type="button" className="btn primary btn-icon" disabled><Icon name="send" />Book &amp; send link</button>}
        </form>
      </aside>
      </div>
    </>
  );
}
