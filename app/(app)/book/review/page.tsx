import Link from "next/link";
import { redirect } from "next/navigation";
import { bookFromWizard } from "@/app/actions";
import { HOLD_MINUTES, thaalLimit } from "@/lib/booking";
import { cartItems } from "@/lib/cart";
import { getHouseholds, getVenues } from "@/lib/data";
import { fmt, inr, SLOT_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Item } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";
import { Submit } from "@/lib/submit";

/** Step 3 — check & confirm: everything on one page, one button. */
export default async function BookReview({ searchParams }: { searchParams: SP }) {
  const { dmy } = await fmt();
  const user = await requireUser();
  const sp = await searchParams;
  const cart = { c: sp.c ?? "", from: sp.from ?? "", to: sp.to ?? "" };
  const event = { ...(sp.p && { p: sp.p }), ...(sp.g && { g: sp.g }), ...(sp.th && { th: sp.th }) };
  const [venues, households] = await Promise.all([getVenues(), getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  let items: Item[];
  try {
    items = cartItems(cart.c, venues);
  } catch {
    redirect("/book");
  }
  if (!items.length) redirect("/book");
  const step1 = `/book?${new URLSearchParams(cart)}`;
  const step2 = `/book/who?${new URLSearchParams({ ...cart, ...event, ...(sp.h && { h: sp.h }) })}`;
  const fix = (msg: string) => redirect(`${step2}&msg=${encodeURIComponent(msg)}`);
  const selected = venues.filter((v) => items.some((i) => i.venueId === v.id));
  const thaalMax = thaalLimit(selected);
  const hh = households.find((h) => h.id === sp.h);
  if (!hh) fix("Choose who this booking is for.");
  if (!sp.g) fix("Enter how many guests are coming.");
  if (thaalMax && !sp.th) fix("Enter how many thaal are needed.");
  if (thaalMax && Number(sp.th) > thaalMax) fix(`The chosen halls hold up to ${thaalMax} thaal. Add another hall or lower the number.`);
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
          <dd><b>{hh!.name}</b> · HOF {hh!.hof} · {hh!.mobile}</dd>
          <dd><Link href={step2}>Change</Link></dd>

          <dt>Hall / room</dt>
          <dd>{items.map((i) => <div key={i.venueId + i.date}>{i.venueName} · {dmy(i.date)} · {SLOT_LABEL[i.slot]} · {inr(i.rate)}</div>)}</dd>
          <dd><Link href={step1}>Change</Link></dd>

          <dt>Event</dt>
          <dd>{sp.p} · {sp.g} guests{sp.th && ` · ${sp.th} thaal`}</dd>
          <dd><Link href={step2}>Change</Link></dd>

          <dt>Total to pay</dt>
          <dd className="total">{inr(total)}</dd>
          <dd />
        </dl>

        <p className="alert info">
          This will be reserved for {hh!.name} for {HOLD_MINUTES} minutes. The payment link goes to them by{" "}
          {hh!.whatsappConsent ? "WhatsApp" : "SMS (they have not agreed to WhatsApp)"}.
        </p>

        <form action={bookFromWizard} className="stack mt-4">
          {Object.entries({ ...cart, h: hh!.id }).map(([k, val]) => val && <input key={k} type="hidden" name={k} value={val} />)}
          <input type="hidden" name="purpose" value={sp.p ?? ""} />
          <input type="hidden" name="guests" value={sp.g ?? ""} />
          {sp.th && <input type="hidden" name="thaal" value={sp.th} />}
          <Submit className="btn primary big w-full">Reserve &amp; send payment link</Submit>
          <Link href={step2}>‹ Back</Link>
        </form>
      </div>
    </>
  );
}
