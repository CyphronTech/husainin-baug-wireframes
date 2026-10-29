import { readSheet } from "read-excel-file/browser";

/** Browser-side: first sheet of a .xlsx, or a .csv, as rows of trimmed strings (header row included). Dates → YYYY-MM-DD. */
// shortcut: CSV split on commas, no quoted fields. Excel files go through the real parser, so use .xlsx for commas in text.
export async function readRows(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name))
    return (await file.text()).split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(",").map((c) => c.trim()));
  const rows = await readSheet(file);
  return rows
    .map((r) => r.map((c) => (c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim())))
    .filter((r) => r.some(Boolean));
}
