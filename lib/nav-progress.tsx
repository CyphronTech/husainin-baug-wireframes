"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Call before a router.push the user didn't start with a link click (e.g. a dropdown), so the loader shows. */
export const startNav = () => window.dispatchEvent(new Event("navstart"));

/**
 * App-wide "please wait" for page changes: a bar across the top at once, then a "Loading…" pill if it takes a moment.
 * Starts on any same-site link click or GET form submit, stops when the URL changes.
 */
export function NavProgress() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setBusy(false), [path, query]);

  // A popover joins the top layer, so the loader also shows above an open booking popup (<dialog>); re-showing puts it on top.
  useEffect(() => {
    const el = ref.current;
    if (!el?.showPopover) return;
    if (busy) {
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    } else if (el.matches(":popover-open")) el.hidePopover();
  }, [busy]);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 20_000); // never leave the loader up if a navigation silently fails
    return () => clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    const here = () => location.pathname + location.search;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
      if (a.pathname + a.search !== here()) setBusy(true);
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if (!e.defaultPrevented && f.method === "get" && f.action.startsWith(location.origin)) setBusy(true);
    };
    const onStart = () => setBusy(true);
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("navstart", onStart);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("navstart", onStart);
    };
  }, []);

  return (
    <div ref={ref} popover="manual" className={`navprog${busy ? " on" : ""}`} aria-hidden={!busy}>
      <div className="navprog-bar" />
      <div className="navprog-pill" role="status"><span className="spinner" />Loading, please wait…</div>
    </div>
  );
}
