// Minimal A4 PDF writer, no dependency. Pages are raw content-stream ops; fonts: F1 Helvetica, F2 Helvetica-Bold,
// F3 Courier (aligned columns), all WinAnsi. Non-Latin text is drawn as vector paths instead (see lib/lisan.ts).
// shortcut: standard fonts have no ₹ glyph, so amounts print as "Rs." and text is Latin-only.
// Upgrade: embed a TTF (e.g. via pdf-lib) if Gujarati/Arabic names or the ₹ sign are required.

/** PDF string literal content: ₹ → "Rs.", anything outside printable ASCII → "?". */
export const pdfEsc = (s: string) => s.replace(/₹\s?/g, "Rs. ").replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1");

/** Text op at (x, y). font: 1 regular, 2 bold, 3 mono. */
export const pdfText = (x: number, y: number, s: string, size = 11, font: 1 | 2 | 3 = 1) => `BT /F${font} ${size} Tf ${x} ${y} Td (${pdfEsc(s)}) Tj ET`;

/** Pages are 595 pt wide (A4); `height` 842 = A4, less for a slip. */
export function pdfDoc(pages: string[], height = 842) {
  const font = (name: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  // Objects 1-5 are fixed; each page then adds two: the page (6, 8, …) and its content (7, 9, …).
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${6 + 2 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    font("Helvetica"),
    font("Helvetica-Bold"),
    font("Courier"),
    ...pages.flatMap((ops, i) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + 2 * i} 0 R >>`,
      `<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`,
    ]),
  ];
  let out = "%PDF-1.4\n";
  const offsets = objs.map((o, i) => {
    const at = Buffer.byteLength(out);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
