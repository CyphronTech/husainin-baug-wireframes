import Link from "next/link";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { AutoForm } from "@/lib/client";
import { getVenues } from "@/lib/data";
import { dmy, inr, SLOT_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Slot } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";
import { qs, readWizard, slotOf, wizardItems } from "@/lib/wizard";

const TYPES: [string, string][] = [["M", "Morning"], ["E", "Evening"], ["D", "Full day"], ["X", "Several days"]];

/** Step 1 — when & where. Wizard state lives in the URL (lib/wizard.ts); w = first day of the visible week, vt = venue filter. */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const w = readWizard(sp);
  const week = sp.w || w.from;
  const picked = w.v.split(",").filter(Boolean);
  const slot = slotOf(w);

  const [allVenues, { days, locks }] = await Promise.all([getVenues(), loadWeek(week)]);
  const shown = allVenues.filter((v) => v.active && (!sp.vt || v.type === sp.vt));
  let items: ReturnType<typeof wizardItems>["items"] = [];
  let selected: ReturnType<typeof wizardItems>["selected"] = [];
  let error = "";
  try {
    ({ items, selected } = wizardItems(w, allVenues));
  } catch (e) {
    error = (e as Error).message;
  }

  const base = { t: w.t, from: w.from, to: w.to, v: w.v, vt: sp.vt, w: week };
  const href = (o: Record<string, string | undefined>) => `/book?${qs({ ...base, ...o })}`;
  const inRange = (d: string) => d >= w.from && d <= w.to;
  // Clicking a free slot picks that venue; on a new date (single-day types) it starts a fresh selection.
  const freeHref = (venueId: string, date: string, s: Slot) => {
    const sameDate = w.t === "X" || date === w.from;
    const v = sameDate ? [...new Set([...picked, venueId])] : [venueId];
    const nt = s === "D" || w.t === "D" || w.t === "X" ? w.t : s;
    return href({ t: nt, from: w.t === "X" ? w.from : date, to: w.t === "X" ? w.to : date, v: v.join(",") });
  };
  const total = items.reduce((a, i) => a + i.rate, 0);
  const when = w.from === w.to ? dmy(w.from) : `${dmy(w.from)} to ${dmy(w.to)}`;

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={1} />
      <Msg msg={sp.msg || error} />

      <div className="card when">
        <div>
        <h2>1. What time of day?</h2>
        <div className="toggles">
          {TYPES.map(([k, label]) => (
            <Link key={k} className={`toggle${w.t === k ? " on" : ""}`} href={href({ t: k, to: k === "X" ? w.to : w.from })}>{label}</Link>
          ))}
        </div>
        </div>
        <div>
        <h2>2. Which date?</h2>
        <AutoForm className="row">
          {Object.entries({ t: w.t, vt: sp.vt, ...(w.t !== "X" && { v: "" }) }).map(([k, val]) => val !== undefined && <input key={k} type="hidden" name={k} value={val} />)}
          <label>{w.t === "X" ? "First day" : "Date"}<input type="date" name="from" defaultValue={w.from} /></label>
          {w.t === "X" && <label>Last day<input type="date" name="to" defaultValue={w.to} /></label>}
          {w.t === "X" && <input type="hidden" name="v" value={w.v} />}
        </AutoForm>
        </div>
      </div>

      <div className="card">
        <div className="top" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>3. Tap a free hall or room</h2>
          <span className="row" style={{ alignItems: "center" }}>
            <Link className="btn" href={href({ w: addDays(week, -7) })}>‹ Earlier</Link>
            <Link className="btn" href={href({ w: addDays(week, 7) })}>Later ›</Link>
          </span>
        </div>
        <details className="filter" open={!!sp.vt}>
          <summary>Show only halls or rooms</summary>
          <div className="toggles">
            {([["", "All"], ["hall", "Halls"], ["room", "Rooms"]] as const).map(([k, label]) => (
              <Link key={k} className={`toggle small${(sp.vt ?? "") === k ? " on" : ""}`} href={href({ vt: k || undefined })}>{label}</Link>
            ))}
          </div>
        </details>
        <Legend picked />
        <Calendar
          venues={shown}
          days={days}
          locks={locks}
          freeHref={freeHref}
          picked={(v, d, s) => picked.includes(v) && inRange(d) && (s === "D" || slot === "D" || s === slot)}
        />
        {selected.length > 1 && <p className="note">If any one of these is taken, the whole booking is not made.</p>}
      </div>

      <div className="sticky">
        {items.length ? (
          <>
            <div className="sticky-sum">
              {selected.map((v) => {
                const vi = items.filter((i) => i.venueId === v.id);
                return (
                  <div key={v.id}>
                    <b>{v.name}</b> · {when} · {SLOT_LABEL[vi[0].slot]} · {inr(vi.reduce((a, i) => a + i.rate, 0))}{" "}
                    <Link href={href({ v: picked.filter((x) => x !== v.id).join(",") })}>Remove</Link>
                  </div>
                );
              })}
              {selected.length > 1 && <div><b>Total {inr(total)}</b></div>}
            </div>
            <Link className="btn primary big" href={`/book/who?${qs({ t: w.t, from: w.from, to: w.to, v: w.v })}`}>Continue →</Link>
          </>
        ) : (
          <span className="muted">Nothing chosen yet. Tap a free slot above.</span>
        )}
      </div>
    </>
  );
}
