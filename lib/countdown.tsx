"use client";

import { useEffect, useState } from "react";

/** Live "9:42 left to pay" countdown to an ISO time. */
export function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => Date.parse(until) - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(Date.parse(until) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (left <= 0) return <b className="countdown over">Time is up. Refresh the page to see the latest status.</b>;
  const s = Math.floor(left / 1000);
  return <b className="countdown" role="timer">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} left to pay</b>;
}
