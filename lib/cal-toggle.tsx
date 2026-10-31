"use client";

import { useRouter } from "next/navigation";

/** Switches every date in the app between Misri (Bohri, the default) and English; the choice lives in the `cal` cookie. */
export function CalToggle({ hijri }: { hijri: boolean }) {
  const router = useRouter();
  const set = (v: "hijri" | "en") => {
    document.cookie = `cal=${v}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div className="seg" role="group" aria-label="Calendar">
      <button type="button" className={`btn${hijri ? " primary" : ""}`} aria-pressed={hijri} onClick={() => set("hijri")}>Misri</button>
      <button type="button" className={`btn${hijri ? "" : " primary"}`} aria-pressed={!hijri} onClick={() => set("en")}>English</button>
    </div>
  );
}
