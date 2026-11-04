import Link from "next/link";
import { redirect } from "next/navigation";
import { thaalLimit } from "@/lib/booking";
import { cartItems } from "@/lib/cart";
import { getHouseholds, getSectors, getVenues } from "@/lib/data";
import { inr } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Item } from "@/lib/types";
import { Msg, Steps, type SP } from "@/lib/ui";

const PURPOSES = ["Wedding", "Majlis", "Family function", "Meeting", "Other"];

/** Step 2 — who is it for: household, then event details. URL adds h (household), p (purpose), g (guests), th (thaal). */
export default async function BookWho({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cart = { c: sp.c ?? "", from: sp.from ?? "", to: sp.to ?? "" };
  const [venues, sectors, households] = await Promise.all([getVenues(), getSectors(), getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  let items: Item[];
  try {
    items = cartItems(cart.c, venues);
  } catch {
    redirect("/book");
  }
  if (!items.length) redirect("/book");
  const back = `/book?${new URLSearchParams(cart)}`;
  const selected = venues.filter((v) => items.some((i) => i.venueId === v.id));
  const hh = households.find((h) => h.id === sp.h);
  const term = (sp.q ?? "").trim().toLowerCase();
  const matches = term ? households.filter((h) => `${h.hof} ${h.name} ${h.mobile}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const capacity = selected.filter((v) => v.type === "hall").reduce((s, v) => s + v.capacity, 0);
  const thaalMax = thaalLimit(selected);
  const event = { ...(sp.p && { p: sp.p }), ...(sp.g && { g: sp.g }), ...(sp.th && { th: sp.th }) };
  const here = (o: Record<string, string>) => `/book/who?${new URLSearchParams({ ...cart, ...event, ...o })}`;
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name;
  const hidden = (o: Record<string, string | undefined>) => Object.entries(o).map(([k, val]) => val && <input key={k} type="hidden" name={k} value={val} />);

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={2} />
      <Msg msg={sp.msg} />

      <div className="card stack">
        <h2>1. Who is this booking for?</h2>
        {hh ? (
          <div className="pick on">
            <b>✓ {hh.name}</b><br />HOF {hh.hof} · Mobile {hh.mobile} · {sectorName(hh.sectorId)}
            <div className="mt-3"><Link href={here({})}>Choose someone else</Link></div>
          </div>
        ) : (
          <>
            <form className="row">
              {hidden({ ...cart, ...event })}
              <label>Type a name, HOF ID or mobile number<input name="q" defaultValue={sp.q} autoFocus /></label>
              <button className="btn">Find</button>
            </form>
            {matches.map((h) => (
              <Link key={h.id} className="pick" href={here({ h: h.id })}>
                <b>{h.name}</b><br />HOF {h.hof} · Mobile {h.mobile} · {sectorName(h.sectorId)}
              </Link>
            ))}
            {term && !matches.length && <p className="muted">No one found. Check the spelling or try the mobile number.</p>}
            <Link href={`/households?back=${encodeURIComponent(here({}))}`}>Not listed? Add a new household</Link>
          </>
        )}
      </div>

      <form action="/book/review" className="card stack">
        {hidden({ ...cart, h: hh?.id })}
        <h2>2. About the event</h2>
        <div className="row">
          <label>What is the event?<select name="p" defaultValue={sp.p ?? "Wedding"}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label>How many guests?<input name="g" type="number" min={1} max={capacity || undefined} defaultValue={sp.g} required /></label>
          {thaalMax > 0 && <label>How many thaal?<input name="th" type="number" min={1} max={thaalMax} defaultValue={sp.th} required /></label>}
        </div>
        {thaalMax > 0 && <p className="muted">The chosen halls hold up to {capacity} guests and {thaalMax} thaal.</p>}

        <div className="sticky in-card">
          <div><b>{items.length} {items.length === 1 ? "slot" : "slots"} · {inr(items.reduce((s, i) => s + i.rate, 0))}</b><br /><Link href={back}>‹ Back</Link></div>
          <button className="btn primary big">Continue →</button>
        </div>
      </form>
    </>
  );
}
