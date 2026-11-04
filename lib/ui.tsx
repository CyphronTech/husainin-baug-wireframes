import { Fragment } from "react";

export function Msg({ msg }: { msg?: string }) {
  return msg ? <p className="msg">{msg}</p> : null;
}
export const Badge = ({ s }: { s: string }) => <span className={`badge ${s.toLowerCase().replace(/ /g, "-")}`}>{s[0].toUpperCase() + s.slice(1)}</span>;
export type SP = Promise<Record<string, string | undefined>>;

const STEPS = ["When & where", "Who is it for", "Check & confirm"];
export const Steps = ({ on }: { on: number }) => (
  <div className="card steps">
    {STEPS.map((label, i) => (
      <Fragment key={label}>{i > 0 && <i />}<span data-n={i + 1} className={i + 1 < on ? "done" : i + 1 === on ? "on" : ""}>{label}</span></Fragment>
    ))}
  </div>
);
