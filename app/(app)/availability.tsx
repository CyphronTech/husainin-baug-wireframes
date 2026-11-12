import { Icon } from "@/lib/icons";
import Form from "next/form";
import Link from "next/link";
import { addDays, Calendar, Legend, loadWeek } from "@/lib/calendar";
import { getVenues } from "@/lib/data";
import { MultiSelect, Select } from "@/lib/dropdown";
import { fmt, today } from "@/lib/format";
import { dateToIso } from "@/lib/misri";
import type { SP } from "@/lib/ui";

/**
 * View-only availability calendar on the dashboard. URL: start, month, venue = what the calendar shows.
 * venue holds venue ids and the types "hall" / "room": repeated by the filter form, comma-joined by the week links.
 */
// Month filter jumps to the 1st of that month (Misri or English, per the user's calendar); prev/next week links carry `start`.
const weekStart = (sp: Awaited<SP>) => dateToIso(sp.start ?? "") || dateToIso(sp.month?.length === 7 ? `${sp.month}-01` : sp.month ?? "") || today();

/** The calendar's reads. A dashboard calls this before its own reads so both run at once instead of one after the other. */
export function availabilityData(sp: Awaited<SP>) {
  const p = Promise.all([getVenues(), loadWeek(weekStart(sp))]);
  p.catch(() => {}); // the rejection still reaches Availability; this only stops an "unhandled" warning if the page fails first
  return p;
}

export async function Availability({ sp, data = availabilityData(sp) }: { sp: Awaited<SP>; data?: ReturnType<typeof availabilityData> }) {
  const { monthStart, monthLabel } = await fmt();
  const start = weekStart(sp);
  const months = Array.from({ length: 15 }, (_, i) => monthStart(today(), i - 2));
  const curMonth = monthStart(start);
  const [allVenues, { days, locks }] = await data;
  const active = allVenues.filter((v) => v.active);
  const picked = [sp.venue].flat().join(",").split(",").filter(Boolean);
  const venues = active.filter((v) => !picked.length || picked.includes(v.id) || picked.includes(v.type));
  const each = sp.rooms === "each"; // rooms are grouped by type unless asked to show each room
  const q = (s: string, o: Record<string, string> = each ? { rooms: "each" } : {}) => `?${new URLSearchParams({ start: s, ...(picked.length && { venue: picked.join(",") }), ...o })}`;
  const hasRooms = venues.some((v) => v.type === "room");

  return (
    <div className="card">
      <div className="top mb-2">
        <h2 className="m0">Check availability <span className="badge muted">View only</span></h2>
        <span><Link prefetch={false} scroll={false} className="btn btn-icon" href={q(addDays(start, -7))}><Icon name="back" />Prev week</Link> <Link prefetch={false} scroll={false} className="btn btn-icon" href={q(addDays(start, 7))}>Next week<Icon name="next" /></Link></span>
      </div>
      <p className="alert notice"><b>This calendar only shows what is free. You can&apos;t book from here.</b> To book, go to <Link href="/book">New booking</Link>.</p>
      <Form action="/" scroll={false} className="row mb-3">
        {each && <input type="hidden" name="rooms" value="each" />}
        <MultiSelect
          label="Halls & rooms"
          name="venue"
          empty="All halls & rooms"
          selected={picked}
          options={[{ value: "hall", label: "All halls" }, { value: "room", label: "All rooms" }, ...active.map((v) => ({ value: v.id, label: v.name }))]}
        />
        {/* Query changes don't remount this page, so a key is what makes a select pick up a new default. */}
        <Select label="Month" key={curMonth} name="month" defaultValue={curMonth}>
          {!months.includes(curMonth) && <option value={curMonth}>{monthLabel(curMonth)}</option>}
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
        <button className="btn btn-icon"><Icon name="filter" />Apply</button>
      </Form>
      <div className="cal-view">
        <Legend />
        <Calendar venues={venues} days={days} locks={locks} groupRooms={!each} />
      </div>
      {hasRooms && (
        <p className="mt-3">
          <Link prefetch={false} scroll={false} className="btn btn-icon" href={q(start, each ? {} : { rooms: "each" })}>
            <Icon name={each ? "back" : "next"} />{each ? "Group rooms by type" : "Show each room"}
          </Link>
        </p>
      )}
      <div className="alert info">Halls book by Morning (M) or Evening (E) slot; both slots = Full day. Rooms book by full day. The calendar shows bookings from every Sector / Mohalla.</div>
    </div>
  );
}
