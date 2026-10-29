"use client";

import { useState } from "react";
import { importHouseholds } from "@/app/actions";

type Row = { hof: string; name: string; mobile: string; address: string; whatsappConsent: boolean; result: string };

function parse(rows: string[][], known: Set<string>): Row[] {
  return rows.slice(1).map(([hof = "", name = "", mobile = "", address = "", consent = ""]) => {
    const err = !/^\d{8,10}$/.test(hof) ? "HOF ID must be 8–10 digits" : !name ? "name missing" : mobile.replace(/\D/g, "").length < 10 ? "mobile invalid" : "";
    return { hof, name, mobile, address, whatsappConsent: /^y/i.test(consent), result: err ? `Error: ${err}` : known.has(hof) ? "Update existing" : "New" };
  });
}

/** Preview runs in the browser; the server action validates everything again (incl. HOFs owned by other sectors). */
export function HouseholdImport({ known, sectorId }: { known: string[]; sectorId?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [file, setFile] = useState("");
  const valid = rows.filter((r) => !r.result.startsWith("Error"));

  return (
    <div className="stack">
      <div className="row">
        <a className="btn" href="/households-template.csv" download>Download template</a>
        <label>Upload CSV / Excel
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFile(f.name);
              const { readRows } = await import("@/lib/sheet"); // Excel parser only downloads when a file is picked
              setRows(parse(await readRows(f), new Set(known)));
            }}
          />
        </label>
      </div>
      <span className="muted">Columns: HOF ID, Name, Mobile, Address, WhatsApp consent (Yes/No)</span>
      {rows.length > 0 && (
        <>
          <b>{file} · {rows.length} rows read</b>
          <table>
            <thead><tr><th>Row</th><th>HOF ID</th><th>Name</th><th>Mobile</th><th>Result</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.hof}</td><td>{r.name || "—"}</td><td>{r.mobile}</td><td>{r.result}</td></tr>)}</tbody>
          </table>
          <p className="alert info m0">Existing HOF IDs are updated, new ones added. HOF IDs registered to another Sector / Mohalla are rejected on import.</p>
          <form action={importHouseholds} className="row">
            <input type="hidden" name="rows" value={JSON.stringify(valid.map(({ result, ...r }) => r))} />
            {sectorId && <input type="hidden" name="sectorId" value={sectorId} />}
            <button className="btn primary" disabled={!valid.length}>Import {valid.length} valid rows</button>
            <button type="button" className="btn" onClick={() => setRows([])}>Cancel</button>
          </form>
        </>
      )}
    </div>
  );
}
