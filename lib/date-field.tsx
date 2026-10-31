"use client";

import { useEffect, useRef, useState } from "react";
import { englishLabel, fromMisri, misri, MISRI_MONTHS, misriLabel } from "./misri";

type Props = { hijri: boolean; name: string; defaultValue?: string; required?: boolean };

/** Date picker in the header toggle's calendar (Misri or English month grid), the other calendar's date shown under it. Submits YYYY-MM-DD either way. */
export function DateField(p: Props) {
  // key: same-route navigations keep the component, so a new server value must remount it.
  return <DatePicker key={p.defaultValue} {...p} />;
}

const DAY = 864e5;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** Month arithmetic for one calendar; months may overflow (13 = first month of next year). */
const CAL = {
  hijri: {
    of: (iso: string) => misri(iso),
    start: (y: number, m: number) => fromMisri(y, m),
    title: (y: number, m: number) => `${MISRI_MONTHS[m - 1]} ${y}`,
    label: misriLabel,
  },
  en: {
    of: (iso: string) => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10) }),
    start: (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10),
    title: (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    label: englishLabel,
  },
};

function DatePicker({ hijri, name, defaultValue, required }: Props) {
  const cal = hijri ? CAL.hijri : CAL.en;
  const other = hijri ? CAL.en : CAL.hijri;
  const today = todayIST();
  const [v, setV] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => cal.of(defaultValue || today));
  const [at, setAt] = useState({ top: 0, left: 0 });
  const [focus, setFocus] = useState(v || today); // the day keyboard focus sits on (roving tabindex)
  const box = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const close = (refocus: boolean) => (setOpen(false), refocus && trigger.current?.focus());

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const drop = () => setOpen(false); // fixed popover would drift from its field on scroll
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    addEventListener("scroll", drop, true);
    addEventListener("resize", drop);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      removeEventListener("scroll", drop, true);
      removeEventListener("resize", drop);
    };
  }, [open]);
  // Move real focus to the focused day when the picker opens or the arrow keys move it.
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focus}"]`)?.focus({ preventScroll: true }); // a scroll would close the picker
  }, [open, focus]);
  const toggle = () => {
    // Fixed, not absolute: cards clip overflow (overflow-x: auto), which would cut the popover off.
    const r = box.current!.getBoundingClientRect();
    setAt({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, innerWidth - 272)) });
    setView(cal.of(v || today));
    setFocus(v || today);
    setOpen(!open);
  };

  const first = cal.start(view.y, view.m);
  const days = (Date.parse(cal.start(view.y, view.m + 1)) - Date.parse(first)) / DAY;
  const lead = new Date(first + "T00:00:00Z").getUTCDay();
  const pick = (iso: string) => (setV(iso), close(true));
  const inView = (iso: string) => iso >= first && iso < cal.start(view.y, view.m + 1);
  /** Arrows: day / week. Home, End: start / end of the week. Page Up, Page Down: same day last / next month. */
  const onKey = (e: React.KeyboardEvent) => {
    const wd = new Date(focus + "T00:00:00Z").getUTCDay();
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -wd, End: 6 - wd };
    let n: string | undefined;
    if (e.key in step) n = addDays(focus, step[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const { y, m, d } = cal.of(focus);
      const dm = e.key === "PageUp" ? -1 : 1;
      const start = cal.start(y, m + dm);
      const len = (Date.parse(cal.start(y, m + dm + 1)) - Date.parse(start)) / DAY;
      n = addDays(start, Math.min(d, len) - 1); // 30 Ramadaan → 29 Shawwal, 31 Jan → 28 Feb
    }
    if (!n) return;
    e.preventDefault();
    setFocus(n);
    if (!inView(n)) setView(cal.of(n));
  };
  const move = (n: number) => setView(cal.of(cal.start(view.y, view.m + n)));

  return (
    <span className="datefield" ref={box} onBlur={(e) => open && !box.current?.contains(e.relatedTarget) && setOpen(false)}>
      {/* Carries the value; not type=hidden so `required` still blocks an empty submit. */}
      <input className="datefield-value" name={name} value={v} required={required} onChange={() => {}} tabIndex={-1} aria-hidden />
      <button type="button" ref={trigger} className="datefield-btn" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        {v ? <>{cal.label(v)}<span className="sr-only">, </span><small className="muted">{other.label(v)}</small></> : <span className="muted">Select date</span>}
      </button>
      {open && (
        // preventDefault: a click on the popover's empty space would otherwise re-activate the label's button.
        <div className="datefield-pop" role="dialog" aria-label="Pick a date" style={at} onClick={(e) => e.preventDefault()}>
          <div className="datefield-head">
            <button type="button" className="btn" aria-label="Previous month" onClick={() => move(-1)}>‹</button>
            <b>{cal.title(view.y, view.m)}</b>
            <button type="button" className="btn" aria-label="Next month" onClick={() => move(1)}>›</button>
          </div>
          <div className="datefield-grid" ref={grid} onKeyDown={onKey}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="muted">{d}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const iso = addDays(first, i);
              const cls = `${iso === v ? "on" : ""}${iso === today ? " today" : ""}`;
              const tab = iso === focus || (!inView(focus) && i === 0) ? 0 : -1;
              return <button key={iso} type="button" data-iso={iso} tabIndex={tab} className={cls} aria-pressed={iso === v} aria-current={iso === today ? "date" : undefined} aria-label={`${cal.label(iso)}, ${other.label(iso)}`} title={other.label(iso)} onClick={() => pick(iso)}>{i + 1}</button>;
            })}
          </div>
          <div className="datefield-foot">
            {!required && <button type="button" className="link" onClick={() => pick("")}>Clear</button>}
            <button type="button" className="link" onClick={() => pick(today)}>Today</button>
          </div>
        </div>
      )}
    </span>
  );
}
