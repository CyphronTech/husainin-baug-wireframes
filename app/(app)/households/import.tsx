"use client";

import { useState } from "react";
import { importHouseholds } from "@/app/actions";

type Row = { hof: string; name: string; mobile: string; address: string; whatsappConsent: boolean; result: string };

// shortcut: CSV only, naive comma split (no quoted commas). Excel users "Save as CSV". Upgrade: a real CSV/xlsx parser.
function parse(text: string, known: Set<string>): Row[] {
  return text
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const [hof = "", name = "", mobile = "", address = "", consent = ""] = l.split(",").map((x) => x.trim());
      const err = !/^\d{8}$/.test(hof) ? "HOF ID must be 8 digits" : !name ? "name missing" : mobile.replace(/\D/g, "").length < 10 ? "mobile invalid" : "";
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
        <input
          type="file"
          accept=".csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f.name);
            setRows(parse(await f.text(), new Set(known)));
          }}
        />
      </div>
      <span className="muted">Columns: HOF ID, Name, Mobile, Address, WhatsApp consent (Yes/No)</span>
      {rows.length > 0 && (
        <>
          <b>{file} · {rows.length} rows read</b>
          <table>
            <thead><tr><th>Row</th><th>HOF ID</th><th>Name</th><th>Mobile</th><th>Result</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.hof}</td><td>{r.name || "—"}</td><td>{r.mobile}</td><td>{r.result}</td></tr>)}</tbody>
          </table>
          <p className="note" style={{ margin: 0 }}>Existing HOF IDs are updated, new ones added. HOF IDs registered to another Sector / Mohalla are rejected on import.</p>
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
