import type { Household } from "@/lib/types";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Avatar, name, HOF, mobile and Sector / Mohalla. Wrap in .hh-pick (a link to pick it, or a div once picked). */
export function HouseholdCard({ h, sector }: { h: Household; sector?: string }) {
  return (
    <>
      <span className="chip-avatar" aria-hidden="true">{initials(h.name)}</span>
      <span className="hh-main">
        <b>{h.name}</b>
        <span className="muted">HOF {h.hof} · {h.mobile}</span>
        <span className="muted">{sector}</span>
      </span>
    </>
  );
}
