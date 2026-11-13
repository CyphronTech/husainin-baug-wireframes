import { b2Enabled, uploadPublic } from "./b2";
import { ist } from "./format";
import { LISAN } from "./lisan";
import { pdfDoc, pdfText as T } from "./pdf";
import type { Booking } from "./types";

/** Invoice numbers contain "/" (HB/26-27/0001); file names and storage paths can't. */
export const receiptFile = (b: Booking) => `Invoice_${b.receiptNo!.replace(/\//g, "-")}.pdf`;

// Letterhead, as on the trust's printed receipt book.
const TRUST = ["Husainin Baug", "Trust Regn. No. B-8 Pune", "1987, Convent Street, Camp, Pune-411001", "Tel: 020-26356786, 020-26335286"];

/** A Lisan ud-Dawat label (pre-shaped vector paths) whose right edge sits at x. */
function lisan(key: keyof typeof LISAN, right: number, y: number, size = 14) {
  const { w, d } = LISAN[key];
  const s = size / 1000;
  return `q ${s} 0 0 ${s} ${(right - w * s).toFixed(1)} ${y} cm ${d} f Q`;
}

const ONES = "Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen".split(" ");
const TENS = "  Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety".split(" ");
const below1000 = (n: number): string =>
  n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? " " + below1000(n % 100) : ""}`
  : n >= 20 ? `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`
  : ONES[n];
/** Indian numbering in words: 123456 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six Only". Whole rupees. */
export function rupeesInWords(amount: number) {
  let n = Math.round(amount);
  const parts: string[] = [];
  for (const [unit, size] of [["Crore", 1e7], ["Lakh", 1e5], ["Thousand", 1e3]] as const) {
    const q = Math.floor(n / size);
    if (q) parts.push(`${q >= 1000 ? rupeesInWords(q).replace(/ Only$/, "") : below1000(q)} ${unit}`);
    n %= size;
  }
  if (n || !parts.length) parts.push(below1000(n));
  return `${parts.join(" ")} Only`;
}

// shortcut: Helvetica width ≈ 0.55 em per character, used only to centre/fit Latin text; real AFM widths if it looks off.
const approxW = (s: string, size: number) => s.length * size * 0.55;
const centred = (y: number, s: string, size: number, font: 1 | 2 = 1) => T(Math.round(297.5 - approxW(s, size) / 2), y, s, size, font);

/** The trust's printed receipt slip (same fields and layout), on a half-A4 page. */
export function receiptPdf(b: Booking) {
  const paid = ist(b.payment?.paidAt ?? b.createdAt);
  const ddmmyy = `${paid.slice(8, 10)}/${paid.slice(5, 7)}/${paid.slice(2, 4)}`;
  const R = 540; // right edge for the Lisan labels (they read right to left)
  const amt = `${b.amount.toLocaleString("en-IN")}.00`;
  const amtLeft = 462 - approxW(amt, 13);
  const words = rupeesInWords(b.amount);
  const wordsRoom = amtLeft - 8 - LISAN.amount.w * 0.014 - 8 - 60; // between x=60 and the انكه label
  const ops = [
    centred(408, TRUST[0], 16, 2),
    centred(394, TRUST[1], 9),
    centred(380, TRUST[2], 11, 2),
    centred(366, TRUST[3], 11, 2),
    "0.8 w 30 20 535 330 re S", // receipt box
    lisan("date", 200, 318), T(60, 318, ddmmyy, 12),
    lisan("receiptNo", R, 318), T(350, 318, b.receiptNo ?? "", 13, 2),
    lisan("honorific", 165, 278, 13), lisan("name", R, 278), T(185, 278, b.household.name.toUpperCase(), 12, 2),
    lisan("fromYou", R, 246), T(Math.round(amtLeft), 246, amt, 13, 2),
    lisan("amount", Math.round(amtLeft - 8), 246),
    T(words.length > 30 ? 60 : 150, 246, words, Math.max(8, Math.min(11, Math.floor(wordsRoom / (words.length * 0.5)))), 2),
    lisan("greeting", R, 214),
    T(60, 214, "PAN No.:", 10),
    T(60, 196, `E.Jamat No.: ${b.household.hof}`, 10),
    T(60, 178, `Contact No.: ${b.household.mobile}`, 10),
    T(60, 160, `Come From: ${b.sectorName}`, 10),
    T(60, 138, `${(b.payment?.method ?? "").toUpperCase()} Ref No.: ${b.payment?.paymentId ?? ""}`, 12, 2),
    lisan("greeting", 400, 112), T(410, 112, "Voluntary Contribution", 11, 2),
    T(150, 44, "Donor Signature", 10), lisan("received", R, 52, 13),
  ];
  return pdfDoc([ops.join("\n")], 430);
}

/** Saves the receipt PDF to B2 and returns the link that goes on WhatsApp. Never throws (payment is already done). */
export async function storeReceipt(b: Booking) {
  const fallback = `${process.env.APP_URL}/r/${b.id}/pdf`; // generated live by the app
  if (!b2Enabled()) return fallback;
  try {
    return await uploadPublic(`receipts/${b.id}/${receiptFile(b)}`, receiptPdf(b), "application/pdf");
  } catch (e) {
    console.error("[b2]", e);
    return fallback;
  }
}
