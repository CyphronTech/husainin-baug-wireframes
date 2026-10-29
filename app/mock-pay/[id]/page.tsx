import { notFound } from "next/navigation";
import { mockPay } from "@/app/actions";
import { db } from "@/lib/firebase-admin";
import { inr } from "@/lib/format";
import { mockPayments } from "@/lib/razorpay";
import { requireUser } from "@/lib/session";
import type { Booking } from "@/lib/types";

// Stand-in for the Razorpay hosted payment page. Exists only while RAZORPAY_KEY_ID is unset.
// "Pay" calls the same markPaid() the real webhook calls, so the rest of the flow is exercised for real.
// Signed-in staff only: on a public deployment anyone holding a link could otherwise mark a booking paid.
export default async function MockPay({ params }: { params: Promise<{ id: string }> }) {
  if (!mockPayments) notFound();
  await requireUser();
  const { id } = await params;
  const q = await db.collection("bookings").where("payment.linkId", "==", id).limit(1).get();
  if (q.empty) notFound();
  const b = q.docs[0].data() as Booking;

  return (
    <main className="login">
      <div className="card stack narrow">
        <span className="badge warn">MOCK RAZORPAY</span>
        <h2>Pay {inr(b.amount)}</h2>
        <p className="muted">Husainin Baug booking {b.no} · {b.household.name}</p>
        {b.status === "pending" ? (
          ["upi", "card", "netbanking"].map((m) => (
            <form key={m} action={mockPay}>
              <input type="hidden" name="linkId" value={id} />
              <input type="hidden" name="method" value={m} />
              <button className="btn primary w-full">Pay with {m}</button>
            </form>
          ))
        ) : (
          <p>This link is no longer payable (booking {b.status}).</p>
        )}
      </div>
    </main>
  );
}
