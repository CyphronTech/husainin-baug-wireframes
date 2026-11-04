import Link from "next/link";
import { redirect } from "next/navigation";
import { getHouseholds, getSectors, getVenues } from "@/lib/data";
import { inr, summary } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Msg, Steps, type SP } from "@/lib/ui";
import { qs, readWizard, wizardItems } from "@/lib/wizard";

const PURPOSES = ["Wedding", "Majlis", "Family function", "Meeting", "Other"];

/** Step 2 — who is it for: household + purpose + guests. */
export default async function BookWho({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const w = readWizard(sp);
  const back = `/book?${qs({ t: w.t, from: w.from, to: w.to, v: w.v })}`;
  const [venues, sectors, households] = await Promise.all([getVenues(), getSectors(), getHouseholds(user.role === "admin" ? undefined : user.sectorId!)]);
  let picked;
  try {
    picked = wizardItems(w, venues);
  } catch {
    redirect(back);
  }
  const { items, selected } = picked;
  if (!items.length) redirect(back);

  const hh = households.find((h) => h.id === w.h);
  const term = (sp.q ?? "").trim().toLowerCase();
  const matches = term ? households.filter((h) => `${h.hof} ${h.name} ${h.mobile}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const capacity = selected.filter((v) => v.type === "hall").reduce((s, v) => s + v.capacity, 0);
  const here = (o: Record<string, string | undefined>) => `/book/who?${qs({ ...w, q: sp.q, ...o })}`;
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name;
  const hidden = (o: Record<string, string | undefined>) =>
    Object.entries(o).map(([k, val]) => val && <input key={k} type="hidden" name={k} value={val} />);

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
            <div><Link href={here({ h: undefined })}>Choose someone else</Link></div>
          </div>
        ) : (
          <>
            <form className="row">
              {hidden({ ...w })}
              <label>Type a name, HOF ID or mobile number<input name="q" defaultValue={sp.q} autoFocus /></label>
              <button className="btn">Find</button>
            </form>
            {matches.map((h) => (
              <Link key={h.id} className="pick" href={here({ h: h.id, q: undefined })}>
                <b>{h.name}</b><br />HOF {h.hof} · Mobile {h.mobile} · {sectorName(h.sectorId)}
              </Link>
            ))}
            {term && !matches.length && <p className="muted" style={{ margin: 0 }}>No one found. Check the spelling or try the mobile number.</p>}
            <Link href={`/households?back=${encodeURIComponent(here({}))}`}>Not listed? Add a new household</Link>
          </>
        )}
      </div>

      <form action="/book/review" className="card stack">
        {hidden({ t: w.t, from: w.from, to: w.to, v: w.v, h: w.h })}
        <h2>2. About the event</h2>
        <div className="row">
          <label>What is the event?<select name="p" defaultValue={w.p ?? "Wedding"}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label>How many guests?<input name="g" type="number" min={1} max={capacity || undefined} defaultValue={w.g} required /></label>
        </div>
        {capacity > 0 && <p className="muted" style={{ margin: 0 }}>The hall holds up to {capacity} guests.</p>}

        <div className="sticky">
          <div className="sticky-sum"><div><b>{summary(items)}</b> · {inr(items.reduce((s, i) => s + i.rate, 0))}</div><Link href={back}>‹ Back</Link></div>
          <button className="btn primary big">Continue →</button>
        </div>
      </form>
    </>
  );
}
