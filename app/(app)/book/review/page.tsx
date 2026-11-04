import Link from "next/link";
import { redirect } from "next/navigation";
import { bookFromWizard } from "@/app/actions";
import { HOLD_MINUTES } from "@/lib/booking";
import { getHouseholds, getVenues } from "@/lib/data";
import { dmy, inr, SLOT_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Msg, Steps, type SP } from "@/lib/ui";
import { qs, readWizard, wizardItems } from "@/lib/wizard";

/** Step 3 — check & confirm: everything on one page, one button. */
export default async function BookReview({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const w = readWizard(sp);
  const step1 = `/book?${qs({ t: w.t, from: w.from, to: w.to, v: w.v })}`;
  const step2 = `/book/who?${qs({ ...w })}`;
  const [venues, households] = await Promise.all([getVenues(), getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  let picked;
  try {
    picked = wizardItems(w, venues);
  } catch {
    redirect(step1);
  }
  const { items } = picked;
  if (!items.length) redirect(step1);
  const hh = households.find((h) => h.id === w.h);
  if (!hh) redirect(`${step2}&msg=${encodeURIComponent("Choose who this booking is for.")}`);
  if (!w.g) redirect(`${step2}&msg=${encodeURIComponent("Enter how many guests are coming.")}`);
  const total = items.reduce((s, i) => s + i.rate, 0);

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={3} />
      <Msg msg={sp.msg} />
      <div className="card">
        <h2>Please check before confirming</h2>
        <dl className="summary">
          <dt>For</dt>
          <dd><b>{hh.name}</b> · HOF {hh.hof} · {hh.mobile}</dd>
          <dd><Link href={step2}>Change</Link></dd>

          <dt>Hall / room</dt>
          <dd>{items.map((i) => <div key={i.venueId + i.date}>{i.venueName} · {dmy(i.date)} · {SLOT_LABEL[i.slot]} · {inr(i.rate)}</div>)}</dd>
          <dd><Link href={step1}>Change</Link></dd>

          <dt>Event</dt>
          <dd>{w.p} · {w.g} guests</dd>
          <dd><Link href={step2}>Change</Link></dd>

          <dt>Total to pay</dt>
          <dd className="total">{inr(total)}</dd>
          <dd />
        </dl>

        <p className="note">
          This will be reserved for {hh.name} for {HOLD_MINUTES} minutes.{" "}
          {hh.whatsappConsent
            ? "A payment link will be sent to them on WhatsApp."
            : "They have not agreed to WhatsApp messages, so you will need to send them the payment link yourself."}
        </p>

        <form action={bookFromWizard} className="stack" style={{ marginTop: 16 }}>
          {Object.entries(w).map(([k, val]) => val && <input key={k} type="hidden" name={k} value={val} />)}
          <button className="btn primary big wide">Reserve &amp; send payment link</button>
          <Link href={step2}>‹ Back</Link>
        </form>
      </div>
    </>
  );
}
