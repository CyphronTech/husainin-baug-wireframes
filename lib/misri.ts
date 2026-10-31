/** Dawoodi Bohra (Misri) calendar: tabular Hijri, Thursday epoch, 30-year cycle with these leap years. Pure: safe in client components. */
const LEAP = [2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29];
const EPOCH = 492149; // days from 1 Moharram 1 AH (15 Jul 622 Julian) to 1970-01-01
export const MISRI_MONTHS = ["Moharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II", "Rajab", "Shabaan", "Ramadaan", "Shawwal", "Zilqad", "Zilhaj"];
const yLen = (y: number) => (LEAP.includes(y % 30) ? 355 : 354);
const mLen = (y: number, m: number) => (m % 2 || (m === 12 && yLen(y) === 355) ? 30 : 29);

/** YYYY-MM-DD → Misri { y, m (1–12), d }. */
export function misri(iso: string) {
  let n = Date.parse(iso + "T00:00:00Z") / 864e5 + EPOCH;
  let y = 1 + 30 * Math.floor(n / 10631);
  n %= 10631;
  while (n >= yLen(y)) n -= yLen(y++);
  let m = 1;
  while (n >= mLen(y, m)) n -= mLen(y, m++);
  return { y, m, d: n + 1 };
}

/** Misri date → YYYY-MM-DD. Month may overflow (13 = Moharram of next year, 0 = Zilhaj of last). */
export function fromMisri(y: number, m: number, d = 1) {
  y += Math.floor((m - 1) / 12);
  m = ((((m - 1) % 12) + 12) % 12) + 1;
  let n = 10631 * Math.floor((y - 1) / 30);
  for (let i = y - ((y - 1) % 30); i < y; i++) n += yLen(i);
  for (let i = 1; i < m; i++) n += mLen(y, i);
  return new Date((n + d - 1 - EPOCH) * 864e5).toISOString().slice(0, 10);
}

/** English month names, fixed (Intl's en-GB gives "Sept", and server and browser could differ). */
export const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** YYYY-MM-DD → "01 Nov 2026". */
export const englishLabel = (iso: string) => `${iso.slice(8, 10)} ${EN_MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

export const misriLabel = (iso: string) => {
  const h = misri(iso);
  return `${h.d} ${MISRI_MONTHS[h.m - 1]} ${h.y}`;
};
