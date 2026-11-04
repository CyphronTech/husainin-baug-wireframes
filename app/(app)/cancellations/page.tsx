import { redirect } from "next/navigation";

// Cancellations moved into My bookings / All bookings; this keeps old links working.
export default function Cancellations() {
  redirect("/my-bookings?status=Cancellation+requested");
}
