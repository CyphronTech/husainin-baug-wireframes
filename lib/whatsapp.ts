// RichAutomate WhatsApp template send (https://richautomate.in/docs/api). Templates must be approved by Meta first
// (RichAutomate → Templates), with body variables in this order:
//   hold:      {{1}} name, {{2}} booking no, {{3}} venue · date · slot, {{4}} amount, {{5}} minutes, {{6}} payment link
//   confirmed: {{1}} name, {{2}} booking no, {{3}} venue · date · slot, {{4}} amount, {{5}} receipt link
//   cancelled: {{1}} name, {{2}} booking no, {{3}} venue · date · slot, {{4}} refund amount
//   reminder:  {{1}} name, {{2}} booking no, {{3}} venue · date · slot, {{4}} first booked date
const TEMPLATES = {
  hold: process.env.RICHAUTOMATE_TEMPLATE_HOLD ?? "booking_on_hold",
  confirmed: process.env.RICHAUTOMATE_TEMPLATE_CONFIRMED ?? "booking_confirmed",
  cancelled: process.env.RICHAUTOMATE_TEMPLATE_CANCELLED ?? "booking_cancelled",
  reminder: process.env.RICHAUTOMATE_TEMPLATE_REMINDER ?? "booking_reminder",
};
export type Template = keyof typeof TEMPLATES;

/**
 * Never throws: a failed message must not undo a payment or cancellation. Returns delivery-accepted.
 * `key` = Idempotency-Key: RichAutomate won't send (or bill) the same key twice within 24 h.
 */
export async function sendWhatsApp(template: Template, mobile: string, values: string[], key?: string) {
  if (!process.env.RICHAUTOMATE_API_KEY) {
    console.log(`[whatsapp:dev] ${template} → ${mobile}`, values);
    return true;
  }
  try {
    const res = await fetch("https://richautomate.in/api/v1/send-template", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RICHAUTOMATE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(key && { "Idempotency-Key": key }),
      },
      body: JSON.stringify({
        phone: `91${mobile}`,
        template: TEMPLATES[template],
        language: process.env.RICHAUTOMATE_LANG ?? "en",
        variables: values,
      }),
    });
    if (!res.ok) console.error("[whatsapp]", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[whatsapp]", e);
    return false;
  }
}
