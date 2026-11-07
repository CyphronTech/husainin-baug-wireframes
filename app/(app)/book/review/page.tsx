import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { bookFromWizard } from "@/app/actions";
import { HOLD_MINUTES } from "@/lib/booking";
import { cartItems } from "@/lib/cart";
import { getHouseholds, getSectors, getVenues } from "@/lib/data";
import { fmt, inr, SLOT_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Household, Item } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";
import { Submit } from "@/lib/submit";
import { Icon } from "@/lib/icons";
import { Purpose } from "./purpose";

const PURPOSES = ["Wedding", "Majlis", "Family function", "Meeting", "Other"];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Step 3–4: pick the household, fill the event details, check the summary and create the booking. */
export default async function BookReview({ searchParams }: { searchParams: SP }) {
  const { dmy } = await fmt();
  const user = await requireUser();
  const sp = await searchParams;
  const state = { c: sp.c ?? "", ...(sp.from && { from: sp.from }), ...(sp.to && { to: sp.to }), ...(sp.hall && { hall: sp.hall }), ...(sp.th && { th: sp.th }) };
  const [venues, sectors, households] = await Promise.all([getVenues(), getSectors(), getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  let items: Item[];
  try {
    items = cartItems(state.c, venues);
  } catch {
    redirect("/book");
  }
  if (!items.length) redirect("/book");
  const back = `/book/slots?${new URLSearchParams(state)}`;
  const selected = venues.filter((v) => items.some((i) => i.venueId === v.id));
  const hh = households.find((h) => h.id === sp.h);
  const term = (sp.q ?? "").toLowerCase();
  const matches = term ? households.filter((h) => `${h.hof} ${h.name} ${h.mobile}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const hasHall = selected.some((v) => v.type === "hall");
  const total = items.reduce((s, i) => s + i.rate, 0);
  const here = (o: Record<string, string>) => `/book/review?${new URLSearchParams({ ...state, ...(sp.h && { h: sp.h }), ...(sp.q && { q: sp.q }), ...o })}`;
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name;
  const hhCard = (h: Household) => (
    <>
      <span className="chip-avatar" aria-hidden="true">{initials(h.name)}</span>
      <span className="hh-main">
        <b>{h.name}</b>
        <span className="muted">HOF {h.hof} · {h.mobile}</span>
        <span className="muted">{sectorName(h.sectorId)}</span>
      </span>
    </>
  );

  return (
    <>
      <div className="top"><h1>Household &amp; event</h1></div>
      <Steps on={hh ? 4 : 3} />
      <Msg msg={sp.msg} />
      <div className="review-grid">
        <div>
          <section className="card">
            <h2><span className="step-n">1</span>Household</h2>
            {hh ? (
              <div className="hh-pick on">
                {hhCard(hh)}
                <Link className="icon-btn" href={here({ h: "", q: "" })} aria-label="Change household" title="Change household"><Icon name="pencil" /></Link>
              </div>
            ) : (
              <>
                <Form action="/book/review" className="hh-search">
                  {Object.entries(state).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
                  <label className="sr-only" htmlFor="hh-q">Search household by HOF ID, name or mobile</label>
                  <input id="hh-q" name="q" type="search" defaultValue={sp.q} placeholder="Search by HOF ID, name or mobile" autoComplete="off" />
                  <button className="icon-btn primary" aria-label="Search" title="Search"><Icon name="search" /></button>
                </Form>
                <div className="hh-results">
                  {matches.map((h) => <Link key={h.id} className="hh-pick" href={here({ h: h.id })}>{hhCard(h)}</Link>)}
                  {term && !matches.length && <p className="muted m0">No household matches “{sp.q}”.</p>}
                  {!term && <p className="muted m0">Search, then tap the household to book for.</p>}
                </div>
                <Link className="btn mt-3 btn-icon" href={`/households?back=${encodeURIComponent(here({}))}`}><Icon name="userPlus" />New household</Link>
              </>
            )}
          </section>

          <section className="card">
            <h2><span className="step-n">2</span>Event details</h2>
            {/* After a failed save the server sends purpose back in the URL, so the choice survives. The server still checks a blank "Other". */}
            <Purpose
              options={PURPOSES}
              initial={!sp.purpose ? "Wedding" : PURPOSES.includes(sp.purpose) ? sp.purpose : "Other"}
              initialOther={sp.purposeOther ?? ""}
            />
          </section>
        </div>

        <aside className="card review-sum">
          <div className="top mb-2"><h2 className="m0">Summary</h2><Link className="icon-btn" href={back} aria-label="Edit slots" title="Edit slots"><Icon name="pencil" /></Link></div>
          <ul className="cart-list">
            {items.map((i) => (
              <li key={i.venueId + i.date}>
                <div><b>{i.venueName}</b><div className="muted">{dmy(i.date)} · {SLOT_LABEL[i.slot]}</div></div>
                <span className="cart-rate">{inr(i.rate)}</span>
              </li>
            ))}
          </ul>
          {hasHall && sp.th && <div className="sum-row"><span>No. of thaal</span><span>{sp.th}</span></div>}
          <div className="sum-total"><span>Total payable</span><b>{inr(total)}</b></div>
          <p className="muted sum-note">
            Holds the slots for {HOLD_MINUTES} minutes and sends a Razorpay payment link to the household by {hh && !hh.whatsappConsent ? "SMS (no WhatsApp consent)" : "WhatsApp"}.
          </p>
          {!hh && <p className="alert warn m0">Select a household first.</p>}
          <form id="book" action={bookFromWizard} className="step-nav">
            {Object.entries(state).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
            <input type="hidden" name="h" value={hh?.id ?? ""} />
            {hasHall && <input type="hidden" name="thaal" value={sp.th ?? ""} />}{/* entered on step 1; the server checks it against the halls */}
            <Link className="btn btn-icon" href={back}><Icon name="back" />Back</Link>
            <Submit className="btn primary btn-icon" disabled={!hh}><Icon name="send" />Book &amp; send link</Submit>
          </form>
        </aside>
      </div>
    </>
  );
}
