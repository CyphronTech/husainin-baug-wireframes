import { markPaid } from "@/lib/booking";
import { verifyWebhook } from "@/lib/razorpay";

// Razorpay dashboard → Webhooks → URL: {APP_URL}/api/razorpay/webhook, event: payment_link.paid
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-razorpay-signature"))) return new Response("bad signature", { status: 400 });
  const e = JSON.parse(raw);
  if (e.event === "payment_link.paid") {
    const p = e.payload.payment.entity;
    await markPaid(e.payload.payment_link.entity.id, p.id, p.method);
  }
  return new Response("ok");
}
