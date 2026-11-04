import Form from "next/form";
import Link from "next/link";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { DateField } from "@/lib/date-field";
import { getVenues } from "@/lib/data";
import { fmt, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";
import { MultiSelect, Select } from "@/lib/dropdown";
import { requireUser } from "@/lib/session";
import { Msg, Steps, type SP } from "@/lib/ui";

/**
 * Step 1 and the availability calendar on one page. The form opens the slot picker (/book/slots, a popup on soft navigation).
 * URL: from, to, hall, th, c, s = booking details and cart. start, month, venue = what the calendar shows (read-only).
 * venue holds venue ids and the types "hall" / "room": repeated by the filter form, comma-joined by the week links.
 */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  const { hijri, monthStart, monthLabel } = await fmt();
  await requireUser();
  const sp = await searchParams;

  // Month filter jumps to the 1st of that month (Misri or English, per the header toggle); prev/next week links carry `start`.
  const browsed = dateToIso(sp.start ?? "") || dateToIso(sp.month?.length === 7 ? `${sp.month}-01` : sp.month ?? "");
  const start = browsed || dateToIso(sp.from ?? "") || today();
  const months = Array.from({ length: 15 }, (_, i) => monthStart(today(), i - 2));
  const curMonth = monthStart(start);
  const [allVenues, { days, locks }] = await Promise.all([getVenues(), loadWeek(start)]);
  const active = allVenues.filter((v) => v.active);
  const picked = [sp.venue].flat().join(",").split(",").filter(Boolean);
  const venues = active.filter((v) => !picked.length || picked.includes(v.id) || picked.includes(v.type));

  // Booking details follow the calendar unless the URL says otherwise. A bad date falls back.
  const fromDate = dateToIso(sp.from ?? "") || browsed;
  const from = fromDate > today() ? fromDate : today();
  const toDate = dateToIso(sp.to ?? "");
  const to = toDate >= from ? toDate : addDays(from, 6);
  const cart = (sp.c ?? "").split(",").filter(Boolean);
  const hall = sp.hall || active.find((v) => picked.includes(v.id))?.id || cart[cart.length - 1]?.split("_")[0];

  const keep = Object.fromEntries(Object.entries({ start, venue: picked.join(","), th: sp.th, c: sp.c, s: sp.s }).filter(([, v]) => v)) as Record<string, string>;
  const q = (extra: Record<string, string>) => `?${new URLSearchParams({ ...keep, ...extra })}`;

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={1} />
      <Msg msg={sp.msg} />
      <div className="card">
        <h2>Booking details</h2>
        <Form action="/book/slots" className="row">
          {sp.c && <input type="hidden" name="c" value={sp.c} />}
          {sp.s && <input type="hidden" name="s" value={sp.s} />}
          <label><span>From date <span className="req" aria-hidden="true">*</span></span><DateField hijri={hijri} name="from" required defaultValue={from} /></label>
          <label>To date<DateField hijri={hijri} name="to" defaultValue={to} /></label>
          {/* Query changes don't remount this page, so a key is what makes a select pick up a new default. Thaal has none: a typed number must survive calendar links. */}
          <Select label="Hall or room" key={hall} name="hall" defaultValue={hall}>{active.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
          <label><span>No. of thaal <span className="req" aria-hidden="true">*</span></span><input name="th" type="number" min={1} step={1} defaultValue={sp.th} required /></label>
          <button className="btn primary">Choose dates &amp; slots</button>
        </Form>
        {cart.length > 0 && <p className="alert info">Your cart has {cart.length} {cart.length === 1 ? "line" : "lines"}. Click Choose dates &amp; slots to see it.</p>}
      </div>

      <div className="card">
        <div className="top mb-2">
          <h2 className="m0">Check availability <span className="badge muted">View only</span></h2>
          <span><Link prefetch={false} scroll={false} className="btn" href={q({ start: addDays(start, -7) })}>← Prev week</Link> <Link prefetch={false} scroll={false} className="btn" href={q({ start: addDays(start, 7) })}>Next week →</Link></span>
        </div>
        <p className="alert notice"><b>This calendar only shows what is free. You can&apos;t book from here.</b> To book, fill in Booking details above and click Choose dates &amp; slots.</p>
        <Form action="/book" className="row mb-3">
          {sp.th && <input type="hidden" name="th" value={sp.th} />}
          {sp.c && <input type="hidden" name="c" value={sp.c} />}
          {sp.s && <input type="hidden" name="s" value={sp.s} />}
          <MultiSelect
            label="Halls & rooms"
            name="venue"
            empty="All halls & rooms"
            selected={picked}
            options={[{ value: "hall", label: "All halls" }, { value: "room", label: "All rooms" }, ...active.map((v) => ({ value: v.id, label: v.name }))]}
          />
          <Select label="Month" key={curMonth} name="month" defaultValue={curMonth}>
            {!months.includes(curMonth) && <option value={curMonth}>{monthLabel(curMonth)}</option>}
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </Select>
          <button className="btn">Apply</button>
        </Form>
        <div className="cal-view">
          <Legend />
          <Calendar venues={venues} days={days} locks={locks} />
        </div>
        <div className="alert info">Halls book by Morning (M) or Evening (E) slot; both slots = Full day. Rooms book by full day.</div>
      </div>
    </>
  );
}
