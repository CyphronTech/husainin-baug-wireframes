"use client";

import { useFormStatus } from "react-dom";

/** Misri / English segmented control for the header form: which calendar's date comes first. While the save runs (a few seconds), the thumb moves to the clicked one and both are disabled, so nobody clicks twice. */
export function CalButtons({ hijri }: { hijri: boolean }) {
  const { pending, data } = useFormStatus();
  const on = pending && data ? data.get("cal") !== "en" : hijri;
  return (
    <>
      <svg className="caltoggle-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span className="caltoggle-track" data-on={on ? "hijri" : "en"}>
        <span className="caltoggle-thumb" aria-hidden="true" />
        <button name="cal" value="hijri" aria-pressed={on} disabled={pending} aria-busy={pending && on}>Misri</button>
        <button name="cal" value="en" aria-pressed={!on} disabled={pending} aria-busy={pending && !on}>English</button>
      </span>
    </>
  );
}
