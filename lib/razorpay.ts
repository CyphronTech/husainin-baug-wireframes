import { createHmac, timingSafeEqual } from "node:crypto";
import type { Booking } from "./types";

// No SDK: Payment Links is one REST call, webhook verification is one HMAC.
export const mockPayments = !process.env.RAZORPAY_KEY_ID;

export async function createPaymentLink(b: Booking): Promise<{ id: string; url: string }> {
  if (mockPayments) {
    const id = `plink_mock_${b.id}`;
    return { id, url: `${process.env.APP_URL}/mock-pay/${id}` };
  }
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: b.amount * 100,
      currency: "INR",
      reference_id: b.no,
      description: `Husainin Baug booking ${b.no}`,
      customer: { name: b.household.name, contact: `+91${b.household.mobile}` },
      notify: { sms: false, email: false }, // we send the link on WhatsApp ourselves
      // Razorpay's floor for expire_by is 15 min, longer than our 10-min hold; markPaid() handles late payments.
      expire_by: Math.floor(Date.now() / 1000) + 16 * 60,
      callback_url: `${process.env.APP_URL}/r/${b.id}`,
      callback_method: "get",
      notes: { bookingId: b.id },
    }),
  });
  if (!res.ok) throw new Error(`Razorpay: ${await res.text()}`);
  const j = await res.json();
  return { id: j.id, url: j.short_url };
}

export function verifyWebhook(rawBody: string, signature: string | null) {
  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
