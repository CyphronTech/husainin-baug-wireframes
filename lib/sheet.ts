import { readSheet } from "read-excel-file/browser";

// shortcut: no line breaks inside quoted cells, use .xlsx if a cell ever needs one.
export const parseCsv = (text: string) =>
  text.split(/\r?\n/).filter((l) => l.trim()).map((l) =>
    l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"').trim()), // only commas outside quotes split
  );

/** Browser-side: first sheet of a .xlsx, or a .csv, as rows of trimmed strings (header row included). Dates → YYYY-MM-DD. */
export async function readRows(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  const rows = await readSheet(file);
  return rows
    .map((r) => r.map((c) => (c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim())))
    .filter((r) => r.some(Boolean));
}
