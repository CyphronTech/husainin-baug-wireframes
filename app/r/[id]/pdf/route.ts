import { getBooking } from "@/lib/booking";
import { receiptPdf } from "@/lib/receipt";

// Fallback when B2 isn't configured or an upload failed; normally the WhatsApp link points straight at B2.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = await getBooking((await params).id);
  if (!b?.receiptNo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(receiptPdf(b)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Receipt_${b.receiptNo}.pdf"` },
  });
}
