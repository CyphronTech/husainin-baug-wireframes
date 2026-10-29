"use client";

import { useState } from "react";
import { type BlockRow, importBlocks, previewBlocks } from "@/app/actions";
import { ACCEPT, readRows } from "@/lib/sheet";

/** Upload → server preview (validation + clash check, nothing written) → import only the rows that passed. */
export function BlockImport({ kind, label }: { kind: "miqaat" | "maintenance"; label: string }) {
  const [rows, setRows] = useState<(BlockRow & { result: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const ok = rows.filter((r) => r.result === "OK");

  return (
    <div className="stack">
      <div className="row items-center">
        <a className="btn" href="/blocks-template.csv" download>Download template</a>
        <label>{label}
          <input
            type="file"
            accept={ACCEPT}
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              const parsed = (await readRows(f)).slice(1).map(([name = "", from = "", to = "", slot = "", codes = "", notes = ""]) => ({ name, from, to, slot, codes, notes }));
              const results = await previewBlocks(kind, parsed);
              setRows(parsed.map((r, i) => ({ ...r, result: results[i] })));
              setBusy(false);
            }}
          />
        </label>
      </div>
      {busy && <span className="muted">Checking rows…</span>}
      {rows.length > 0 && (
        <>
          <table>
            <thead><tr><th>Row</th><th>Name</th><th>From</th><th>To</th><th>Slot</th><th>Venues</th><th>Result</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name || "—"}</td><td>{r.from}</td><td>{r.to}</td><td>{r.slot}</td><td>{r.codes}</td><td>{r.result}</td></tr>)}</tbody>
          </table>
          <p className="alert info m0">Rows that clash with a booking or another block are rejected and not imported.</p>
          <form action={importBlocks} className="row">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="rows" value={JSON.stringify(ok.map(({ result, ...r }) => r))} />
            <button className="btn primary" disabled={!ok.length}>Import {ok.length} valid rows</button>
            <button type="button" className="btn" onClick={() => setRows([])}>Cancel</button>
          </form>
        </>
      )}
    </div>
  );
}
