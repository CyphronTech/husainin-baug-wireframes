// Minimal single-page text PDF (Helvetica, WinAnsi). Enough for a receipt; no dependency.
// shortcut: standard fonts have no ₹ glyph, so amounts print as "Rs." and text is Latin-only.
// Upgrade: embed a TTF (e.g. via pdf-lib) if Gujarati/Arabic names or the ₹ sign are required.
export function textPdf(lines: { text: string; size?: number; bold?: boolean; gap?: number }[]) {
  const esc = (s: string) => s.replace(/₹\s?/g, "Rs. ").replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1");
  let y = 800;
  const ops = lines
    .map((l) => {
      y -= l.gap ?? 18;
      return `BT /${l.bold ? "F2" : "F1"} ${l.size ?? 11} Tf 50 ${y} Td (${esc(l.text)}) Tj ET`;
    })
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`,
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
