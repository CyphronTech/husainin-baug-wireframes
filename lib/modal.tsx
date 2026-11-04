"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** The page under the popup. Skips /book with a cart and the wizard steps: the cart is stale once the booking exists. */
let lastPage = "/my-bookings";

export function TrackPage() {
  const path = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    const hasCart = path === "/book" && /(^|&)[cs]=/.test(query);
    if (!hasCart && !/^\/(book\/|bookings\/.)/.test(path)) lastPage = query ? `${path}?${query}` : path;
  }, [path, query]);
  return null;
}

/** Popup for an intercepted route. No close on backdrop click: a stray click would lose a half-filled form. */
export function Modal({ label, close, keepQuery, children }: { label: string; close?: string; keepQuery?: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const query = useSearchParams().toString();
  const [openedAt] = useState(path);
  // A parallel slot keeps its last content on soft navigation (a catch-all slot route would 404 /login), so hide here.
  if (path !== openedAt) return null;
  const dismiss = () => router.push(keepQuery && query ? `${close}?${query}` : close ?? lastPage, { scroll: false });
  return (
    <dialog ref={(d) => { if (d && !d.open) d.showModal(); }} className="modal" aria-label={label} onClose={dismiss}>
      <button type="button" className="modal-x" aria-label="Close" onClick={dismiss}>×</button>
      {children}
    </dialog>
  );
}
