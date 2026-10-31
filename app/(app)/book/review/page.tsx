import Link from "next/link";
import { redirect } from "next/navigation";
import { bookFromWizard } from "@/app/actions";
import { HOLD_MINUTES, priceItems } from "@/lib/booking";
import { getHouseholds, getSectors, getVenues } from "@/lib/data";
import { dmy, inr, SLOT_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Slot } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";
import { Submit } from "@/lib/submit";

const PURPOSES = ["Wedding", "Majlis", "Family function", "Meeting", "Other"];

export default async function BookReview({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const state = { t: sp.t ?? "D", from: sp.from ?? "", to: sp.to ?? sp.from ?? "", v: sp.v ?? "" };
  const back = `/book?${new URLSearchParams(state)}`;
  const [venues, sectors, households] = await Promise.all([getVenues(), getSectors(), getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  const selected = venues.filter((v) => v.active && state.v.split(",").includes(v.id));
  let items;
  try {
    items = priceItems(selected, state.from, state.to, state.t === "X" ? "D" : (state.t as Slot));
  } catch {
    redirect(back);
  }
  if (!items.length) redirect(back);
  const hh = households.find((h) => h.id === sp.h);
  const term = (sp.q ?? "").toLowerCase();
  const matches = term ? households.filter((h) => `${h.hof} ${h.name} ${h.mobile}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const capacity = selected.filter((v) => v.type === "hall").reduce((s, v) => s + v.capacity, 0);
  const here = (o: Record<string, string>) => `/book/review?${new URLSearchParams({ ...state, ...(sp.h && { h: sp.h }), ...(sp.q && { q: sp.q }), ...o })}`;
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name;

  return (
    <>
      <div className="top"><h1>New booking · household and review</h1></div>
      <Steps on={hh ? 4 : 2} />
      <Msg msg={sp.msg} />
      <div className="grid g2e mb-5">
        <div className="card">
          <h2>2. Select household</h2>
          <form className="row mb-3">
            {Object.entries(state).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
            {sp.h && <input type="hidden" name="h" value={sp.h} />}
            <label>Search household (HOF ID, name or mobile)<input name="q" defaultValue={sp.q} /></label>
            <button className="btn">Search</button>
          </form>
          {[...(hh ? [hh] : []), ...matches.filter((m) => m.id !== hh?.id)].map((h) => (
            <Link key={h.id} className={`pick${h.id === hh?.id ? " on" : ""}`} href={here({ h: h.id })}>
              <b>{h.name}</b><br />HOF {h.hof} · Mobile {h.mobile}<br />{sectorName(h.sectorId)} · WhatsApp consent: {h.whatsappConsent ? "Yes" : "No"}
            </Link>
          ))}
          {term && !matches.length && <p className="muted">No household found.</p>}
          <Link href={`/households?back=${encodeURIComponent(here({}))}`}>+ Add new household</Link>
        </div>

        <div className="card">
          <h2>3. Event details</h2>
          <div className="stack">
            <label>Purpose<select name="purpose" form="book" defaultValue="Wedding">{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label>Expected guests<input name="guests" form="book" type="number" min={1} max={capacity || undefined} required /></label>
            {capacity > 0 && <p className="alert info m0">Hall capacity for this booking: {capacity} guests.</p>}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>4. Review</h2>
        <table>
          <thead><tr><th>Venue</th><th>Date</th><th>Slot</th><th>Amount</th></tr></thead>
          <tbody>
            {items.map((i) => <tr key={i.venueId + i.date}><td>{i.venueName}</td><td>{dmy(i.date)}</td><td>{SLOT_LABEL[i.slot]}</td><td>{inr(i.rate)}</td></tr>)}
            <tr><td colSpan={3}><b>Total payable (full amount)</b></td><td><b>{inr(items.reduce((s, i) => s + i.rate, 0))}</b></td></tr>
          </tbody>
        </table>
        <p className="alert warn">
          Creating the booking holds the venue for {HOLD_MINUTES} minutes and sends a Razorpay payment link to the household on WhatsApp
          {hh && !hh.whatsappConsent && " (no WhatsApp consent, so it goes by SMS)"}.
        </p>
        <form id="book" action={bookFromWizard} className="row">
          {Object.entries(state).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
          <input type="hidden" name="h" value={hh?.id ?? ""} />
          <Submit className="btn primary" disabled={!hh}>Create booking &amp; send payment link</Submit>
          <Link className="btn" href={back}>Back</Link>
          {!hh && <span className="muted">Select a household first.</span>}
        </form>
      </div>
    </>
  );
}
