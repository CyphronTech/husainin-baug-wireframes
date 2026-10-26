export function Msg({ msg }: { msg?: string }) {
  return msg ? <p className="msg">{msg}</p> : null;
}
export const Badge = ({ s }: { s: string }) => <span className={`badge ${s.toLowerCase()}`}>{s[0].toUpperCase() + s.slice(1)}</span>;
export type SP = Promise<Record<string, string | undefined>>;
