"use client";

import { useState } from "react";

/**
 * One-tap UPI: opens the phone's UPI app with the trust's UPI ID filled in.
 * Demo for now: the amount is editable (blank = payer types it in the app) so testers can try small amounts.
 * Phones only; on desktop the QR above is the way to pay.
 */
export function UpiPayButton({ pa, pn, mc, amount, no }: { pa: string; pn: string; mc: string; amount: number; no: string }) {
  const [am, setAm] = useState(String(amount));
  const n = Number(am);
  const valid = am.trim() === "" || (n > 0 && n <= 100000);
  const q = [["pa", pa], ["pn", pn], ...(mc ? [["mc", mc]] : []), ...(am.trim() && valid ? [["am", n.toFixed(2)]] : []), ["cu", "INR"], ["tn", `Booking ${no}`]];
  const href = "upi://pay?" + q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

  return (
    <div className="stack">
      <label>Amount to pay (₹), blank = enter in the UPI app
        <input inputMode="decimal" value={am} onChange={(e) => setAm(e.target.value)} aria-invalid={!valid} />
      </label>
      {/* noreferrer: don't tell the UPI app which page opened it (same as sites where this works) */}
      <a className="btn primary" href={valid ? href : undefined} rel="noreferrer" aria-disabled={!valid}>
        Pay {am.trim() && valid ? `₹${n.toLocaleString("en-IN")}` : ""} with UPI app
      </a>
      {!valid && <p className="alert warn m0">Enter an amount above ₹0, or leave it blank.</p>}
      <p className="muted m0">Phone only. Opens Google Pay, PhonePe or Paytm with {pa} filled in.</p>
    </div>
  );
}
