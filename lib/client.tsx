"use client";

import { useEffect, useState } from "react";

/** A GET form that submits itself when any field changes, so there is no separate Search button to find. */
export function AutoForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return <form className={className} onChange={(e) => e.currentTarget.requestSubmit()}>{children}</form>;
}

/** Live "9:42 left to pay" countdown to an ISO time. */
export function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(new Date(until).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (left <= 0) return <b className="countdown over">Time is up. Refresh the page to see the latest status.</b>;
  const s = Math.floor(left / 1000);
  return <b className="countdown">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} left to pay</b>;
}
