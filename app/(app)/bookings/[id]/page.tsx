import { Icon } from "@/lib/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decidePaymentAction, releaseBooking, resendLink, uploadPaymentProof } from "@/app/actions";
import { getBooking, messageValues } from "@/lib/booking";
import { rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { displayStatus, fmt, inr, SLOT_LABEL } from "@/lib/format";
import { mockPayments } from "@/lib/razorpay";
import { requireUser } from "@/lib/session";
import type { Booking, Cancellation } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";
import { Submit } from "@/lib/submit";
import { fileHref } from "@/lib/b2";
import { PaidWatcher } from "./paid-watcher";
import { UpiPayButton } from "./upi-pay-button";

const hm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "");

/** Message previews mirror the approved WhatsApp templates (lib/whatsapp.ts). */
const PREVIEW = {
  hold: ([name, no, what, amt, mins, url]: string[]) => [`Booking on hold: ${no}`, `Dear ${name}, ${what} is held for you. Please pay ${amt} within ${mins} minutes:\n${url}\n— Husainin Baug`],
  confirmed: ([, no, what, amt, url]: string[]) => [`Booking confirmed: ${no}`, `Payment of ${amt} received. ${what}.\nReceipt (PDF): ${url}\n— Husainin Baug`],
  cancelled: ([name, no, what, refund]: string[]) => [`Booking cancelled: ${no}`, `Dear ${name}, your booking ${what} is cancelled. Refund: ${refund}.\n— Husainin Baug`],
  reminder: ([name, no, what, date, days]: string[]) => [`Booking reminder: ${no}`, `Dear ${name}, your booking starts in ${days} days, on ${date}: ${what}.\n— Husainin Baug`],
  rejected: ([name, no, what, reason]: string[]) => [`Booking not confirmed: ${no}`, `Dear ${name}, we could not verify your UPI payment for ${what}. Reason: ${reason}. The booking is cancelled; please contact the office.\n— Husainin Baug`],
};

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { dmy, dmyhm, summary } = await fmt();
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
  const wa = log.filter((l) => /^(whatsapp|sms)\./.test(l.action) && !l.action.endsWith(".failed"));
  const at = (...actions: string[]) => log.find((l) => actions.includes(l.action))?.at;
  const rejected = b.rejectReason !== undefined;
  const steps: [string, string | undefined][] = b.proof ? [
    ["Booking created, venue on hold", b.createdAt],
    [`UPI payment screenshot uploaded by ${b.proof.by}`, b.proof.at],
    [rejected ? "Payment rejected by Admin, venue released" : "Payment approved by Admin", rejected ? at("booking.payment_reject") : b.payment?.paidAt],
    [rejected ? "Household told (WhatsApp or SMS)" : `Invoice ${b.receiptNo ?? ""} sent (WhatsApp or SMS)`, rejected ? at("whatsapp.rejected", "sms.rejected") : at("whatsapp.confirmed", "sms.confirmed")],
  ] : [
    ["Booking created, venue on hold", b.createdAt],
    ["Payment link sent (WhatsApp or SMS)", at("whatsapp.hold", "sms.hold")],
    [`Household pays ${inr(b.amount)} via Razorpay${b.payment?.method ? ` ${b.payment.method.toUpperCase()}` : ""}`, b.payment?.paidAt],
    ["Payment confirmed automatically", b.receiptNo ? b.payment?.paidAt : undefined],
    [`Invoice ${b.receiptNo ?? ""} sent (WhatsApp or SMS)`, at("whatsapp.confirmed", "sms.confirmed")],
  ];

  return (
    <>
      <div className="top"><h1>Payment and WhatsApp messages</h1></div>
      <Msg msg={sp.msg} />
      <PaidWatcher waiting={status === "On hold" || (status === "Awaiting approval" && user.role !== "admin")} paid={b.status === "confirmed"} no={b.no} amount={inr(b.amount)} />
      <div className="grid g2e mb-5">
        <div className="card stack">
          <h2 className="m0">Booking {b.no}</h2>
          <p className="m0">
            {summary(b.items)} · {inr(b.amount)}<br />
            {b.household.name} · HOF {b.household.hof} · {b.household.mobile}<br />
            <span className="muted">{b.days?.length ? "" : <>{b.event?.purpose}{b.event?.guests ? ` · ${b.event.guests} guests` : ""}{b.event?.thaal ? ` · ${b.event.thaal} thaal` : ""} · </>}{b.sectorName} · by {b.createdByName}</span>
          </p>
          {!!b.days?.length && (
            <ul className="m0">
              {b.days.map((x) => <li key={x.date + (x.slot ?? "D")}>{dmy(x.date)}{(x.slot ?? "D") !== "D" && ` ${SLOT_LABEL[x.slot!].toLowerCase()}`}: {x.purpose}{x.thaal ? ` · ${x.thaal} thaal` : ""}{x.guests ? ` · ${x.guests} guests` : ""}</li>)}
            </ul>
          )}
          <div className="row items-center">
            <Badge s={status === "On hold" ? "On hold" : status} />
            {status === "On hold" && <b>Hold expires at {hm(b.holdUntil)}</b>}
          </div>
          {status === "On hold" && (
            <>
              <section className="pay-step">
                <h3 className="m0"><span className="pay-n">1</span>Pay {inr(b.amount)} by UPI</h3>
                <p className="muted m0">Household scans with any UPI app (Google Pay, PhonePe, Paytm).</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="upi-qr" src="/upi-qr.jpg" alt="UPI QR code for Husainin Baug" width={240} height={240} />
                <span className="pay-or" aria-hidden="true">OR</span>
                <UpiPayButton pa={process.env.UPI_VPA || "HUSAINIBAUG@rbl"} pn={process.env.UPI_NAME || "HUSAINI BAUG"} mc={process.env.UPI_MC ?? "8661"} amount={b.amount} no={b.no} />
                <span className="pay-or" aria-hidden="true">OR</span>
                <form action={resendLink} className="pay-link"><input type="hidden" name="id" value={id} /><Submit className="btn btn-icon"><Icon name="send" />{b.payment ? "Resend pay link on WhatsApp" : "Send pay link on WhatsApp"}</Submit></form>
              </section>
              <section className="pay-step">
                <h3 className="m0"><span className="pay-n">2</span>Upload the payment screenshot</h3>
                <form action={uploadPaymentProof} className="stack">
                  <input type="hidden" name="id" value={id} />
                  <label>Screenshot of the UPI payment<input type="file" name="proof" accept="image/*" required /></label>
                  <Submit className="btn primary btn-icon"><Icon name="check" />Upload screenshot</Submit>
                </form>
              </section>
              {canAct && <div><form action={releaseBooking}><input type="hidden" name="id" value={id} /><Submit className="btn danger btn-icon"><Icon name="x" />Cancel &amp; release</Submit></form></div>}
              {b.payment && <label>Payment link (copy)<input readOnly value={b.payment.url} /></label>}
              {mockPayments && b.payment && <p className="muted m0">Mock mode — <a href={b.payment.url}>open mock checkout</a></p>}
              {!b.household.whatsappConsent && <p className="alert warn m0">No WhatsApp consent: the link goes by SMS instead.</p>}
              <p className="alert info m0">If payment is not made in time, the booking expires and the venue is released for others.</p>
            </>
          )}
          {status === "Awaiting approval" && (
            <>
              <p className="alert info m0">Screenshot uploaded. The venue stays held until Admin approves the payment.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={fileHref(b.proof!.url)} target="_blank" rel="noreferrer"><img className="proof-img" src={fileHref(b.proof!.url)} alt="Payment screenshot" /></a>
              {user.role === "admin" ? (
                <form action={decidePaymentAction} className="stack">
                  <input type="hidden" name="id" value={id} />
                  <label>Reason, if rejecting<input name="reason" placeholder="e.g. Amount does not match" /></label>
                  <div className="row">
                    <Submit name="decision" value="approve" className="btn primary btn-icon"><Icon name="check" />Approve payment</Submit>
                    <Submit name="decision" value="reject" className="btn danger btn-icon"><Icon name="x" />Reject</Submit>
                  </div>
                </form>
              ) : (
                <form action={uploadPaymentProof} className="row items-end">
                  <input type="hidden" name="id" value={id} />
                  <label>Wrong screenshot? Upload again<input type="file" name="proof" accept="image/*" required /></label>
                  <Submit className="btn btn-icon"><Icon name="refresh" />Replace</Submit>
                </form>
              )}
            </>
          )}
          {status === "Payment rejected" && <p className="alert warn m0">Admin rejected the UPI payment{b.rejectReason ? `: ${b.rejectReason}` : ""}. The venue was released. <Link href="/book">Start a new booking</Link>.</p>}
          {status === "Expired" && <p className="alert info m0">The hold lapsed without payment. <Link href="/book">Start a new booking</Link>.</p>}
          {status === "Refund due" && <p className="alert warn m0">Paid after the hold expired and the slot was taken. Refund {inr(b.amount)} manually (Razorpay {b.payment?.paymentId}).</p>}
          {canAct && status === "Confirmed" && <div><Link className="btn danger btn-icon" href={`/bookings/${id}/cancel`}><Icon name="x" />Request cancellation</Link></div>}
          {crs.map((c) => <p key={c.id} className="muted m0">{c.no}: <Badge s={c.status} /> {c.reason}{c.adminComment && ` — Admin: ${c.adminComment}`}{user.role === "admin" && c.status === "awaiting" && <> <Link href={`/bookings/${id}/cancel`}>Review</Link></>}</p>)}
        </div>

        <div className="card">
          <h2>Progress</h2>
          <ol className="timeline">
            {steps.map(([label, when]) => <li key={label} className={when ? "" : "todo"}>{label}{when && ` (${hm(when)})`}</li>)}
          </ol>
          <table className="mt-3">
            <thead><tr><th>Venue</th><th>Date</th><th>Slot</th><th>Rate</th></tr></thead>
            <tbody>{b.items.map((i) => <tr key={i.venueId + i.date}><td>{i.venueName}</td><td>{dmy(i.date)}</td><td>{SLOT_LABEL[i.slot]}</td><td>{inr(i.rate)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="grid g2e">
        <div className="card">
          <h2>Messages to the household</h2>
          <div className="chat">
            {wa.length === 0 && <span className="muted">No messages sent yet.</span>}
            {wa.map((l, i) => {
              const [channel, tpl] = l.action.split(".") as [string, keyof typeof PREVIEW];
              const [title, body] = PREVIEW[tpl](l.data.values ?? messageValues(b as Booking, tpl));
              return (
                <div key={i} className="bubble">
                  <span className="badge muted">{channel === "sms" ? "SMS" : "WhatsApp"}</span>{"\n"}<b>{title}</b>{"\n\n"}{body}
                  <div className="muted text-right">{hm(l.at)}</div>
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
                <b>Invoice no.</b> {b.receiptNo} · <b>Booking</b> {b.no}<br />
                <b>Household</b> {b.household.name} · HOF {b.household.hof} · {b.household.mobile}<br />
                <b>Sector / Mohalla</b> {b.sectorName}<br />
                <b>Venue</b> {summary(b.items)}<br />
                <b>Amount paid</b> {inr(b.amount)} · {b.proof ? "UPI · approved by Admin" : <>{b.payment?.method?.toUpperCase()} (Razorpay) · {b.payment?.paymentId}</>}<br />
                <b>Paid on</b> {dmyhm(b.payment?.paidAt)}<br />
                Cancellation is subject to Admin approval and the trust&apos;s policy.
              </div>
              <div className="row mt-3">
                <a className="btn btn-icon" href={fileHref(b.receiptUrl ?? `/r/${b.id}/pdf`)}><Icon name="download" />Download PDF</a>
                <Link className="btn primary btn-icon" href="/my-bookings"><Icon name="list" />Go to my bookings</Link>
              </div>
            </>
          ) : (
            <p className="muted">The receipt is generated automatically once the payment is confirmed.</p>
          )}
        </div>
      </div>
    </>
  );
}
