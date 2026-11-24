import { downloadPrivate } from "@/lib/b2";
import { getBooking } from "@/lib/booking";
import { getUser } from "@/lib/session";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Private B2 files for signed-in staff: payments/{bookingId}/… and receipts/{bookingId}/… to that booking's sector
 * (Admin: all), bills/… to Admin only. Anything else is 404, so the route can't be used to read other bucket files.
 */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getUser();
  if (!user) return notFound();
  const path = (await params).path.map(decodeURIComponent);
  const [kind, id] = path;
  if (path.length < 3 || !/^[\w-]+$/.test(id ?? "")) return notFound();
  if (kind === "bills") {
    if (user.role !== "admin") return notFound();
  } else if (kind === "payments" || kind === "receipts") {
    const b = await getBooking(id);
    if (!b || (user.role !== "admin" && b.sectorId !== user.sectorId)) return notFound();
  } else return notFound();

  const res = await downloadPrivate(path.join("/")).catch((e) => (console.error("[b2]", e), null)); // bad B2 key: log, don't 500
  if (!res?.ok) return notFound();
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
