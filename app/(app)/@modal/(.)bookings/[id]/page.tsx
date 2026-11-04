import BookingPage from "@/app/(app)/bookings/[id]/page";
import { Modal } from "@/lib/modal";
import type { SP } from "@/lib/ui";

export default function Page(p: { params: Promise<{ id: string }>; searchParams: SP }) {
  return <Modal label="Booking details"><BookingPage {...p} /></Modal>;
}
