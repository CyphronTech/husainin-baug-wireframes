// MSG91 WhatsApp template send. Templates must be pre-approved (MSG91 panel → WhatsApp → Templates) with body
// variables in this order:
//   hold:      {{1}} name, {{2}} booking no, {{3}} venue · date · slot, {{4}} amount, {{5}} minutes, {{6}} payment link
//   confirmed: {{1}} name, {{2}} booking no, {{3}} venue · date · slot, {{4}} amount — plus a DOCUMENT header (receipt PDF)
//   cancelled: {{1}} name, {{2}} booking no, {{3}} venue · date · slot, {{4}} refund amount
//   otp:       {{1}} code (Meta "Authentication" category template)
const TEMPLATES = {
  hold: process.env.MSG91_WA_TEMPLATE_HOLD ?? "booking_on_hold",
  confirmed: process.env.MSG91_WA_TEMPLATE_CONFIRMED ?? "booking_confirmed",
  cancelled: process.env.MSG91_WA_TEMPLATE_CANCELLED ?? "booking_cancelled",
  otp: process.env.MSG91_WA_TEMPLATE_OTP ?? "login_otp",
};
export type Template = keyof typeof TEMPLATES;

/** Never throws: a failed message must not undo a payment or cancellation. Returns delivery-accepted. */
export async function sendWhatsApp(template: Template, mobile: string, values: string[], doc?: { url: string; filename: string }) {
  if (!process.env.MSG91_AUTHKEY) {
    console.log(`[whatsapp:dev] ${template} → ${mobile}`, values, doc ?? "");
    return true;
  }
  const components: Record<string, object> = Object.fromEntries(values.map((value, i) => [`body_${i + 1}`, { type: "text", value }]));
  // MSG91 fetches the document URL at send time, so the receipt PDF is served live from /r/{id}/pdf — nothing stored.
  if (doc) components.header_1 = { type: "document", value: doc.url, filename: doc.filename };
  try {
    const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: { authkey: process.env.MSG91_AUTHKEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        integrated_number: process.env.MSG91_WA_NUMBER,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: TEMPLATES[template],
            language: { code: process.env.MSG91_WA_LANG ?? "en", policy: "deterministic" },
            namespace: process.env.MSG91_WA_NAMESPACE,
            to_and_components: [{ to: [`91${mobile}`], components }],
          },
        },
      }),
    });
    if (!res.ok) console.error("[whatsapp]", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[whatsapp]", e);
    return false;
  }
}
