// Minimal text PDF (Helvetica, Courier for aligned columns; WinAnsi), a new page when one fills. Enough for a receipt; no dependency.
// shortcut: standard fonts have no ₹ glyph, so amounts print as "Rs." and text is Latin-only.
// Upgrade: embed a TTF (e.g. via pdf-lib) if Gujarati/Arabic names or the ₹ sign are required.
export function textPdf(lines: { text: string; size?: number; bold?: boolean; mono?: boolean; gap?: number }[]) {
  const esc = (s: string) => s.replace(/₹\s?/g, "Rs. ").replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1");
  let y = 800;
  const pages: string[][] = [[]];
  for (const l of lines) {
    y -= l.gap ?? 18;
    if (y < 50) {
      pages.push([]);
      y = 800;
    }
    pages.at(-1)!.push(`BT /${l.mono ? "F3" : l.bold ? "F2" : "F1"} ${l.size ?? 11} Tf 50 ${y} Td (${esc(l.text)}) Tj ET`);
  }
  const font = (name: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  // Objects 1-5 are fixed; each page then adds two: the page (6, 8, …) and its content (7, 9, …).
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${6 + 2 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    font("Helvetica"),
    font("Helvetica-Bold"),
    font("Courier"),
    ...pages.flatMap((p, i) => {
      const ops = p.join("\n");
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + 2 * i} 0 R >>`,
        `<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`,
      ];
    }),
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
