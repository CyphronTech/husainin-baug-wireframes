import Form from "next/form";
import { DateField } from "@/lib/date-field";
import { Icon } from "@/lib/icons";
import { PURPOSES } from "@/lib/types";
import { Purpose } from "./purpose";

/**
 * Date, session, function and size for one booking date, above the halls on the same page. Posts to /book/slots,
 * which checks it, adds it to the dates (ev) and shows that session's halls below.
 */
export function FunctionForm(p: {
  hijri: boolean;
  hidden: Record<string, string>;
  heading: string;
  date: string;
  session: "M" | "E";
  purpose?: string;
  purposeOther?: string;
  th?: string | number;
  g?: string | number;
  /** One-line summary shown while folded. Given = the halls are on screen, so the form starts folded. */
  summary?: string;
}) {
  const inList = !!p.purpose && PURPOSES.includes(p.purpose);
  return (
    <details className="card fn-card" open={!p.summary}>
      <summary>
        <span className="fn-title">
          <h2 className="m0">{p.heading}</h2>
          {p.summary && <span className="fn-sum">{p.summary}</span>}
        </span>
        {p.summary && <span className="btn btn-icon fn-change"><Icon name="pencil" />Change</span>}
      </summary>
      {/* Purpose fields post with form="book" (see purpose.tsx). */}
      <Form id="book" action="/book/slots" scroll={false} className="stack">
        {Object.entries(p.hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <div className="row date-session">
          <label className="date-one"><span>Date <span className="req" aria-hidden="true">*</span></span><DateField hijri={p.hijri} name="d" required defaultValue={p.date} /></label>
          {/* Morning and evening can be different functions with a different number of thaal: enter each as its own session. */}
          <fieldset className="purpose">
            <legend>Session</legend>
            {([["M", "Morning"], ["E", "Evening"]] as const).map(([v, label]) => (
              <label key={v}><input type="radio" name="ss" value={v} defaultChecked={p.session === v} />{label}</label>
            ))}
          </fieldset>
        </div>
        <Purpose options={PURPOSES} initial={!p.purpose ? "Wedding" : inList ? p.purpose : "Other"} initialOther={p.purposeOther ?? (inList ? "" : p.purpose ?? "")} />
        <div>
          <div className="row">
            <label>No. of thaal<input name="th" type="number" inputMode="numeric" min={1} step={1} defaultValue={p.th || ""} /></label>
            <label>No. of guests<input name="g" type="number" inputMode="numeric" min={1} step={1} defaultValue={p.g || ""} /></label>
          </div>
          <p className="muted m0">Enter thaal, guests or both. Halls that fit are listed first.</p>
        </div>
        <div className="row justify-end">
          <button className="btn primary btn-icon"><Icon name="search" />Show halls</button>
        </div>
      </Form>
    </details>
  );
}
