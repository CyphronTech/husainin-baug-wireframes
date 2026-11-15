"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/lib/icons";

/**
 * While a booking waits for payment, re-checks it every few seconds. When the payment lands, a success popup closes the
 * booking: its buttons leave the booking (replace, so Back doesn't reopen the filled-in wizard) for a fresh New booking or the dashboard.
 */
export function PaidWatcher({ waiting, paid, no, amount }: { waiting: boolean; paid: boolean; no: string; amount: string }) {
  const router = useRouter();
  const wasWaiting = useRef(waiting); // only a payment seen on this screen opens the popup
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!waiting) return; // only a live hold can still be paid; an expired one stops checking
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 5000);
    return () => clearInterval(t);
  }, [waiting, router]);

  useEffect(() => {
    if (wasWaiting.current && paid && !ref.current?.open) ref.current?.showModal();
  }, [paid]);

  return (
    <dialog ref={ref} className="modal paid-pop" aria-labelledby="paid-title">
      <div className="paid-icon" aria-hidden="true"><Icon name="check" size={40} /></div>
      <h2 id="paid-title">Payment received</h2>
      <p>Booking <b>{no}</b> is confirmed. {amount} paid. The receipt has been sent to the household.</p>
      <div className="paid-actions">
        <Link replace className="btn primary btn-icon" href="/book"><Icon name="plus" />New booking</Link>
        <Link replace className="btn btn-icon" href="/"><Icon name="home" />Go to dashboard</Link>
      </div>
    </dialog>
  );
}
