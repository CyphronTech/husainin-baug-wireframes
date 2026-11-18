import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getHouseholds, getSectors } from "@/lib/data";
import { Icon } from "@/lib/icons";
import { requireUser } from "@/lib/session";
import { Msg, Steps, type SP } from "@/lib/ui";
import { HouseholdCard } from "./household-card";
import { HhSearchInput } from "./hh-search-input";

/**
 * Step 1 of a new booking: pick the household (ITS / HOF ID). Once picked, step 2 (date, function and halls on one
 * page) is /book/slots; links that still carry h here go straight on to it.
 * URL: h = household, q = household search, d / ss = function to show, ev = functions entered (lib/cart.ts parseDays), c = cart.
 */
export default async function BookStep1({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [households, sectors] = await Promise.all([getHouseholds(user.role === "admin" ? undefined : user.sectorId!), getSectors()]);
  const hh = households.find((h) => h.id === sp.h);
  if (hh) redirect(`/book/slots?${new URLSearchParams(Object.fromEntries(Object.entries({ h: hh.id, d: sp.d, ss: sp.ss, ev: sp.ev, c: sp.c, msg: sp.msg }).filter(([, v]) => v)) as Record<string, string>)}`);

  // Details already entered ride along when the household is searched for or changed.
  const keep = Object.fromEntries(Object.entries({ d: sp.d, ev: sp.ev, c: sp.c }).filter(([, v]) => v)) as Record<string, string>;
  const here = (o: Record<string, string>) => `/book?${new URLSearchParams({ ...keep, ...o })}`;
  const term = (sp.q ?? "").toLowerCase();
  const matches = term ? households.filter((h) => `${h.hof} ${h.name} ${h.mobile}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name;

  return (
    <>
      <div className="top"><h1>New booking</h1></div>
      <Steps on={1} />
      <Msg msg={sp.msg} />
        <div className="card">
          <h2>Who is the booking for?</h2>
          <Form action="/book" className="hh-search">
            {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <label className="sr-only" htmlFor="hh-q">Search household by HOF ID, name or mobile</label>
            <HhSearchInput defaultValue={sp.q} />
            <button className="icon-btn primary" aria-label="Search" title="Search"><Icon name="search" /></button>
          </Form>
          <div className="hh-results">
            {matches.map((h) => <Link key={h.id} className="hh-pick" href={here({ h: h.id })}><HouseholdCard h={h} sector={sectorName(h.sectorId)} /></Link>)}
            {term && !matches.length && <p className="muted m0">No household matches “{sp.q}”.</p>}
            {!term && <p className="muted m0">Search, then tap the household to book for.</p>}
          </div>
          <Link className="btn mt-3 btn-icon" href={`/households?back=${encodeURIComponent(here({}))}`}><Icon name="userPlus" />New household</Link>
          <div className="step-nav">
            <Link className="btn btn-icon" href="/"><Icon name="back" />Cancel</Link>
          </div>
        </div>
    </>
  );
}
