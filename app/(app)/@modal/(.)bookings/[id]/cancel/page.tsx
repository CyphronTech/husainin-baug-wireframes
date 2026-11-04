import CancelBooking from "@/app/(app)/bookings/[id]/cancel/page";
import { Modal } from "@/lib/modal";
import type { SP } from "@/lib/ui";

export default async function Page(p: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await p.params;
  return <Modal label="Cancellation request" close={`/bookings/${id}`}><CancelBooking {...p} /></Modal>;
}
