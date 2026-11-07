import Form from "next/form";
import Link from "next/link";
import { addDays } from "@/lib/calendar";
import { Icon } from "@/lib/icons";
import { DateField } from "@/lib/date-field";
import { fmt, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";
import { requireUser } from "@/lib/session";
import { Msg, Steps, type SP } from "@/lib/ui";

/**
 * Step 1: booking details. The form opens the slot picker (/book/slots, a popup on soft navigation).
 * URL: from, to, hall, th, c, s = booking details and cart. The availability calendar lives on the dashboard.
 */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  const { hijri } = await fmt();
  await requireUser();
  const sp = await searchParams;

  // A bad or past date falls back to today.
  const fromDate = dateToIso(sp.from ?? "");
  const from = fromDate > today() ? fromDate : today();
  const toDate = dateToIso(sp.to ?? "");
  const to = toDate >= from ? toDate : addDays(from, 6);
  const cart = (sp.c ?? "").split(",").filter(Boolean);
  const hall = sp.hall || cart[cart.length - 1]?.split("_")[0];

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={1} />
      <Msg msg={sp.msg} />
      <div className="card">
        <h2>Booking details</h2>
        <Form action="/book/slots">
          {sp.c && <input type="hidden" name="c" value={sp.c} />}
          {sp.s && <input type="hidden" name="s" value={sp.s} />}
          {/* Hall is picked on the slots page; this only reopens it on the cart's hall. */}
          {hall && <input type="hidden" name="hall" value={hall} />}
          <div className="row">
            <label><span>From date <span className="req" aria-hidden="true">*</span></span><DateField hijri={hijri} name="from" required defaultValue={from} /></label>
            <label>To date<DateField hijri={hijri} name="to" defaultValue={to} /></label>
            <label><span>No. of thaal <span className="req" aria-hidden="true">*</span></span><input name="th" type="number" inputMode="numeric" min={1} step={1} defaultValue={sp.th} required /></label>
          </div>
          {cart.length > 0 && <p className="alert info">Your cart has {cart.length} {cart.length === 1 ? "slot" : "slots"}. Press Next to see it.</p>}
          <div className="step-nav">
            <Link className="btn btn-icon" href="/"><Icon name="back" />Cancel</Link>
            <button className="btn primary btn-icon">Next: pick dates<Icon name="next" /></button>
          </div>
        </Form>
      </div>
    </>
  );
}
