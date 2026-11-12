"use client";

import { useEffect } from "react";

/**
 * Phone layout for tables: CSS turns each row into a card (globals.css, max-width 640px), and each cell needs its
 * column name to make sense on its own. This copies the header text into data-label on every cell, also for rows that
 * arrive later (streaming, filters). Calendars (.cal) keep their grid.
 */
export function TableLabels() {
  useEffect(() => {
    const label = () => {
      for (const table of document.querySelectorAll<HTMLTableElement>(".main table:not(.cal)")) {
        const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
        if (!heads.length) continue;
        for (const row of table.querySelectorAll("tbody tr"))
          [...row.children].forEach((td, i) => {
            if (heads[i] && !td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i]);
          });
      }
    };
    // Wait for idle so React has hydrated the new rows first; labelling server HTML before that logs hydration mismatches.
    const later = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
    later(label);
    let queued = false;
    const obs = new MutationObserver(() => {
      if (!queued) (queued = true), later(() => ((queued = false), label()));
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
