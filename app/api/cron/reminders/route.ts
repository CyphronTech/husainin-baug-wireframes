import { timingSafeEqual } from "node:crypto";
import { sendReminders } from "@/lib/booking";

// Google Cloud Scheduler calls this once a day (README → "Booking reminders") with
// header  Authorization: Bearer <CRON_SECRET>.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) return new Response("unauthorized", { status: 401 });
  return Response.json({ sent: await sendReminders() });
}
