import Link from "next/link";
import { notFound } from "next/navigation";
import { releaseBooking, resendLink } from "@/app/actions";
import { getBooking, messageValues } from "@/lib/booking";
import { rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { displayStatus, dmy, dmyhm, inr, SLOT_LABEL, summary } from "@/lib/format";
import { mockPayments } from "@/lib/razorpay";
import { requireUser } from "@/lib/session";
import type { Booking, Cancellation } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

const hm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "");

/** Message previews mirror the approved WhatsApp templates (lib/whatsapp.ts). */
const PREVIEW = {
  hold: ([name, no, what, amt, mins, url]: string[]) => [`Booking on hold: ${no}`, `Dear ${name}, ${what} is held for you. Please pay ${amt} within ${mins} minutes:\n${url}\n— Husainin Baug`],
  confirmed: ([, no, what, amt, url]: string[]) => [`Booking confirmed: ${no}`, `Payment of ${amt} received. ${what}.\nYour receipt: ${url}\n— Husainin Baug`],
  cancelled: ([name, no, what, refund]: string[]) => [`Booking cancelled: ${no}`, `Dear ${name}, your booking ${what} is cancelled. Refund: ${refund}.\n— Husainin Baug`],
};

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const b = await getBooking(id);
  // Household details are scoped to the booking's own Sector / Mohalla — enforced here, not just hidden in the UI.
  if (!b || (user.role !== "admin" && b.sectorId !== user.sectorId)) notFound();
  const canAct = user.role === "admin" || b.createdBy === user.uid;
  const status = displayStatus(b);
  const [crs, log] = await Promise.all([
    db.collection("cancellations").where("bookingId", "==", id).get().then(rows<Cancellation>),
    db.collection("audit").where("data.bookingId", "==", id).get().then((s) => s.docs.map((d) => d.data()).sort((x, y) => x.at.localeCompare(y.at))),
  ]);
  const wa = log.filter((l) => l.action.startsWith("whatsapp.") && !l.action.endsWith(".failed"));
  const at = (action: string) => log.find((l) => l.action === action)?.at;
  const steps: [string, string | undefined][] = [
    ["Booking created, venue on hold", b.createdAt],
    ["Payment link sent on WhatsApp", at("whatsapp.hold")],
    [`Household pays ${inr(b.amount)} via Razorpay${b.payment?.method ? ` ${b.payment.method.toUpperCase()}` : ""}`, b.payment?.paidAt],
    ["Payment confirmed automatically", b.receiptNo ? b.payment?.paidAt : undefined],
    [`Receipt ${b.receiptNo ?? ""} sent on WhatsApp`, at("whatsapp.confirmed")],
  ];

  return (
    <>
      <div className="top"><h1>Payment and WhatsApp messages</h1></div>
      <Msg msg={sp.msg} />
      <div className="grid g2e" style={{ marginBottom: 20 }}>
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Booking {b.no}</h2>
          <p style={{ margin: 0 }}>
            {summary(b.items)} · {inr(b.amount)}<br />
            {b.household.name} · HOF {b.household.hof} · {b.household.mobile}<br />
            <span className="muted">{b.event?.purpose} · {b.event?.guests} guests · {b.sectorName} · by {b.createdByName}</span>
          </p>
          <div className="row" style={{ alignItems: "center" }}>
            <Badge s={status === "On hold" ? "On hold" : status} />
            {status === "On hold" && <b>Hold expires at {hm(b.holdUntil)}</b>}
          </div>
          {status === "On hold" && (
            <>
              <div className="row">
                <form action={resendLink}><input type="hidden" name="id" value={id} /><button className="btn">{b.payment ? "Resend link on WhatsApp" : "Create & send payment link"}</button></form>
                {canAct && <form action={releaseBooking}><input type="hidden" name="id" value={id} /><button className="btn danger">Cancel &amp; release</button></form>}
              </div>
              {b.payment && <label>Payment link (copy)<input readOnly value={b.payment.url} /></label>}
              {mockPayments && b.payment && <p className="muted" style={{ margin: 0 }}>Mock mode — <a href={b.payment.url}>open mock checkout</a></p>}
              {!b.household.whatsappConsent && <p className="warn" style={{ margin: 0 }}>No WhatsApp consent: share the link with the household yourself.</p>}
              <p className="note" style={{ margin: 0 }}>If payment is not made in time, the booking expires and the venue is released for others.</p>
            </>
          )}
          {status === "Expired" && <p className="note" style={{ margin: 0 }}>The hold lapsed without payment. <Link href="/book">Start a new booking</Link>.</p>}
          {status === "Refund due" && <p className="warn" style={{ margin: 0 }}>Paid after the hold expired and the slot was taken. Refund {inr(b.amount)} manually (Razorpay {b.payment?.paymentId}).</p>}
          {canAct && status === "Confirmed" && <div><Link className="btn danger" href={`/bookings/${id}/cancel`}>Request cancellation</Link></div>}
          {crs.map((c) => <p key={c.id} className="muted" style={{ margin: 0 }}>{c.no}: <Badge s={c.status} /> {c.reason}{c.adminComment && ` — Admin: ${c.adminComment}`}</p>)}
        </div>

        <div className="card">
          <h2>Progress</h2>
          <ol className="timeline">
            {steps.map(([label, when]) => <li key={label} className={when ? "" : "todo"}>{label}{when && ` (${hm(when)})`}</li>)}
          </ol>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Venue</th><th>Date</th><th>Slot</th><th>Rate</th></tr></thead>
            <tbody>{b.items.map((i) => <tr key={i.venueId + i.date}><td>{i.venueName}</td><td>{dmy(i.date)}</td><td>{SLOT_LABEL[i.slot]}</td><td>{inr(i.rate)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="grid g2e">
        <div className="card">
          <h2>WhatsApp messages to the household</h2>
          <div className="chat">
            {wa.length === 0 && <span className="muted">No messages sent yet.</span>}
            {wa.map((l, i) => {
              const tpl = l.action.split(".")[1] as keyof typeof PREVIEW;
              const [title, body] = PREVIEW[tpl](l.data.values ?? messageValues(b as Booking, tpl));
              return (
                <div key={i} className="bubble">
                  <b>{title}</b>{"\n\n"}{body}
                  <div className="muted" style={{ textAlign: "right" }}>{hm(l.at)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2>Receipt preview</h2>
          {b.receiptNo ? (
            <>
              <div className="receipt">
                <b>Husainin Baug</b><br />
                <b>Receipt no.</b> {b.receiptNo} · <b>Booking</b> {b.no}<br />
                <b>Household</b> {b.household.name} · HOF {b.household.hof} · {b.household.mobile}<br />
                <b>Sector / Mohalla</b> {b.sectorName}<br />
                <b>Venue</b> {summary(b.items)}<br />
                <b>Amount paid</b> {inr(b.amount)} · {b.payment?.method?.toUpperCase()} (Razorpay) · {b.payment?.paymentId}<br />
                <b>Paid on</b> {dmyhm(b.payment?.paidAt)}<br />
                Cancellation is subject to Admin approval and the trust&apos;s policy.
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <a className="btn" href={b.receiptUrl ?? `/r/${b.id}/pdf`}>Download PDF</a>
                <Link className="btn primary" href="/my-bookings">Go to my bookings</Link>
              </div>
            </>
          ) : (
            <p className="muted">The receipt is generated automatically once Razorpay confirms the payment.</p>
          )}
        </div>
      </div>
    </>
  );
}
