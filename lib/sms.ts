import type { Template } from "./whatsapp";

// MSG91 SMS (Flow API). Each message needs a DLT-approved template, created in MSG91 → SMS → Templates,
// with variables in the same order as the WhatsApp templates (lib/whatsapp.ts) mapped to ##var1##, ##var2##, …
const TEMPLATES: Record<Template, string | undefined> = {
  hold: process.env.MSG91_SMS_TEMPLATE_HOLD,
  confirmed: process.env.MSG91_SMS_TEMPLATE_CONFIRMED,
  cancelled: process.env.MSG91_SMS_TEMPLATE_CANCELLED,
};

/** Never throws. Without MSG91 keys/templates it logs to the console (dev mock). */
export async function sendSms(template: Template, mobile: string, values: string[]) {
  const templateId = TEMPLATES[template];
  if (!process.env.MSG91_AUTHKEY || !templateId) {
    console.log(`[sms:dev] ${template} → ${mobile}`, values);
    return true;
  }
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: process.env.MSG91_AUTHKEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: `91${mobile}`, ...Object.fromEntries(values.map((v, i) => [`var${i + 1}`, v])) }],
      }),
    });
    if (!res.ok) console.error("[sms]", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[sms]", e);
    return false;
  }
}
