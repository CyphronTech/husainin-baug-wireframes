import { Fragment } from "react";

export function Msg({ msg }: { msg?: string }) {
  return msg ? <p className="alert notice" role="status">{msg}</p> : null;
}

const OK = ["confirmed", "paid", "approved", "active"];
const WARN = ["on hold", "pending", "awaiting", "awaiting approval", "cancellation requested", "refund due"];
/** Tone comes from the status word; anything unlisted (cancelled, expired, completed, …) is muted. */
export const Badge = ({ s }: { s: string }) => {
  const k = s.toLowerCase();
  return <span className={`badge ${OK.includes(k) ? "ok" : WARN.includes(k) ? "warn" : "muted"}`}>{s[0].toUpperCase() + s.slice(1)}</span>;
};
export type SP = Promise<Record<string, string | undefined>>;

const STEPS = ["Venue & date", "Household", "Event details", "Review & payment link"];
export const Steps = ({ on }: { on: number }) => (
  <div className="card steps">
    {STEPS.map((label, i) => (
      <Fragment key={label}>{i > 0 && <i />}<span data-n={i + 1} className={i + 1 < on ? "done" : i + 1 === on ? "on" : ""}>{label}</span></Fragment>
    ))}
  </div>
);
