"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { startNav } from "./nav-progress";

/** The page under the popup. Skips /book with a cart and the wizard steps: the cart is stale once the booking exists. */
let lastPage = "/my-bookings";
/** URL on screen and the one before it; a popup reads these as it opens to learn what sits under it. */
let currentUrl = "";
let prevUrl = "";

export function TrackPage() {
  const path = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    const url = query ? `${path}?${query}` : path;
    if (url !== currentUrl) [prevUrl, currentUrl] = [currentUrl, url];
    const hasCart = path === "/book" && /(^|&)[cs]=/.test(query);
    if (!hasCart && !/^\/(book\/|bookings\/.)/.test(path)) lastPage = url;
  }, [path, query]);
  return null;
}

/** Popup for an intercepted route. No close on backdrop click: a stray click would lose a half-filled form. */
export function Modal({ label, close, keepQuery, children }: { label: string; close?: string; keepQuery?: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const query = useSearchParams().toString();
  const [openedAt] = useState(path);
  // A streamed popup can mount after TrackPage has already recorded the popup's own URL; then the page under it is the one before.
  const own = query ? `${path}?${query}` : path;
  const [under] = useState(() => (currentUrl === own ? prevUrl : currentUrl));
  // A parallel slot keeps its last content on soft navigation (a catch-all slot route would 404 /login), so hide here.
  if (path !== openedAt) return null;
  const dismiss = () => {
    const to = keepQuery && query ? `${close}?${query}` : close ?? lastPage;
    startNav();
    // Next ignores a push to the exact URL already under the popup (the × did nothing), so step back to it instead.
    if (to === under) router.back();
    else router.push(to, { scroll: false });
  };
  return (
    <dialog ref={(d) => { if (d && !d.open) d.showModal(); }} className="modal" aria-label={label} onClose={(e) => e.target === e.currentTarget && dismiss()}>{/* React bubbles a nested dialog's close up to here */}
      <button type="button" className="modal-x" aria-label="Close" onClick={dismiss}>×</button>
      {children}
    </dialog>
  );
}
