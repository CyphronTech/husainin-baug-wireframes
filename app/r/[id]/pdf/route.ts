import { getBooking } from "@/lib/booking";
import { receiptFile, receiptPdf } from "@/lib/receipt";

// The receipt link on WhatsApp and SMS: B2 is private, so the PDF is generated live here (public, unguessable booking id).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = await getBooking((await params).id);
  if (!b?.receiptNo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(receiptPdf(b)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${receiptFile(b)}"` },
  });
}
