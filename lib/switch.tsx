/** One-tap on/off switch that posts to a server action. Plain form post, so it works without JS. */
export function Switch({ action, fields, on, label, onText = "On", offText = "Off" }: {
  action: (f: FormData) => Promise<void>;
  /** Hidden fields identifying what to switch; "active" is added with the new value ("1" or "0"). */
  fields: Record<string, string>;
  on: boolean;
  label: string;
  onText?: string;
  offText?: string;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="active" value={on ? "0" : "1"} />
      <button className={`switch${on ? " on" : ""}`} role="switch" aria-checked={on} aria-label={`${label}: ${on ? onText : offText}, tap to change`}>
        <i aria-hidden="true" />
        <span>{on ? onText : offText}</span>
      </button>
    </form>
  );
}

/** Filters that fold behind a "Filters" button on phones and stay open on wider screens. CSS-only (globals.css). */
export function FilterFold({ id, count, children }: { id: string; count: number; children: React.ReactNode }) {
  return (
    <div className="filter-fold">
      <input type="checkbox" id={id} className="filter-toggle sr-only" />
      <label htmlFor={id} className="btn btn-icon filter-btn">Filters{count ? ` (${count})` : ""}</label>
      <div className="filter-fields">{children}</div>
    </div>
  );
}
