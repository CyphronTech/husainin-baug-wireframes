// Venue list (Nov 2026 rate card). Imported by seed.mjs; run directly to sync Firestore:
//   node --env-file=.env.local scripts/venues.mjs          → dry run: lists what would change
//   node --env-file=.env.local scripts/venues.mjs --apply  → writes the list, deletes venues not in it
import { fileURLToPath } from "node:url";

const PERSONS_PER_THAAL = 8; // capacity (guests) shown in Venues; the rate card only gives thaal

// Price is per session: morning = evening = price, full day = both sessions.
const hall = (code, name, price, thaal, ac, capacity = thaal * PERSONS_PER_THAAL) => ({
  code, name, type: "hall", capacity, maxThaal: thaal, ac,
  rates: { morning: price, evening: price, fullDay: price * 2 },
  morningTime: "08:00–15:00", eveningTime: "17:00–23:00", active: true,
});
const room = (code, name, perDay) => ({ code, name, type: "room", capacity: 4, ac: false, rates: { perDay }, morningTime: "", eveningTime: "", active: true });

export const VENUES = [
  hall("VAJ", "Vajihi Hall", 8500, 35, true),
  hall("MUF", "Muffadal Hall", 8500, 30, true),
  hall("SAI", "Saifee Hall", 8500, 12, true),
  hall("SEH", "Seham Hall", 8000, 25, true),
  hall("BUR", "Burhani Hall", 7000, 12, true),
  hall("EVM", "EVM Hall", 6000, 40, false),
  hall("EZZ", "Ezzi Hall", 5500, 15, true),
  hall("JAM", "Jamali Hall", 4500, 12, true),
  hall("JMT", "Jamali Terrace", 4000, 6, false, 50), // rate card: 50 persons (party), no thaal count
  hall("BAD", "Badri Hall", 1000, 6, false),
  ...[1, 2, 3, 4, 5].map((i) => room(`DLX${i}`, `Deluxe Room ${i}`, 3000)),
  ...[1, 2, 3].map((i) => room(`SDX${i}`, `Semi-deluxe Room ${i}`, 2500)),
  room("NRM1", "Normal Room 1", 2000), // shortcut: count unknown on the rate card, add more in Venues
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  const db = getFirestore();
  const apply = process.argv.includes("--apply");
  const keep = new Set(VENUES.map((v) => v.code.toLowerCase()));
  const existing = (await db.collection("venues").get()).docs;
  const stale = existing.filter((d) => !keep.has(d.id));
  for (const d of stale) {
    const locks = await db.collection("locks").where("venueId", "==", d.id).count().get();
    console.log(`delete venues/${d.id} (${d.get("name")}) — ${locks.data().count} lock(s) still point at it`);
  }
  for (const v of VENUES) console.log(`${existing.some((d) => d.id === v.code.toLowerCase()) ? "update" : "create"} venues/${v.code.toLowerCase()} ${v.name}`);
  if (!apply) { console.log("Dry run. Re-run with --apply to write."); process.exit(0); }
  const batch = db.batch();
  for (const v of VENUES) batch.set(db.doc(`venues/${v.code.toLowerCase()}`), v);
  for (const d of stale) batch.delete(d.ref);
  await batch.commit();
  console.log(`Wrote ${VENUES.length} venues, deleted ${stale.length}.`);
}
