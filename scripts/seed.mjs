// One-time setup: venues, sectors, demo households and the first admin (users/{username}).
//   node --env-file=.env.local scripts/seed.mjs            → admin 50450028 / Password
//   node --env-file=.env.local scripts/seed.mjs <username> <password>
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS is empty. Put the service account JSON path in .env.local, e.g.\n  GOOGLE_APPLICATION_CREDENTIALS=C:/keys/husainin-sa.json\n(and make sure there is no second, empty GOOGLE_APPLICATION_CREDENTIALS= line below it)");
  process.exit(1);
}
const [username = "50450028", password = "Password"] = process.argv.slice(2);
initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore();
const batch = db.batch();

const hall = (code, name, capacity, morning, evening, fullDay) => ({ code, name, type: "hall", capacity, rates: { morning, evening, fullDay }, morningTime: "08:00–15:00", eveningTime: "17:00–23:00", active: true });
const room = (code, name, perDay) => ({ code, name, type: "room", capacity: 4, rates: { perDay }, morningTime: "", eveningTime: "", active: true });
for (const v of [hall("MUF", "Muffadal Hall", 500, 15000, 18000, 30000), hall("VAJ", "Vajihi Hall", 300, 10000, 12000, 20000), hall("H3", "Hall 3", 150, 6000, 7000, 12000), hall("H4", "Hall 4", 100, 4000, 5000, 8000), room("R1", "Room 1", 2500), room("R2", "Room 2", 2000)])
  batch.set(db.doc(`venues/${v.code.toLowerCase()}`), v);

const sectors = ["BURHANI MOHALLA (POONA)", "FAKHRI MOHALLA (POONA)", "FATEMI MOHALLA (POONA)", "HASANJI NAGAR (POONA)", "IMADI MOHALLA (POONA)", "JAMALI MOHALLA (POONA)", "KALIMI MOHALLA (POONA)", "KASARWADI", "KHADKI (POONA)", "MUFADDAL MOHALLA (POONA)", "SAIFEE MOHALLAH (POONA)", "TAIYEBI MOHALLA (POONA)", "ZAINI MOHALLA (POONA)"];
for (const s of sectors) {
  const code = s.slice(0, 3);
  batch.set(db.doc(`sectors/${code.toLowerCase()}`), { name: s, code, contactName: "", contactMobile: "", active: true });
}

// A few demo households for the first sector
for (const [hof, name, mobile] of [["50450029", "Aliasgar Chaiwala", "8605480902"], ["50453456", "Taher Bootwala", "9822000013"], ["50455678", "Ali Abbas Sakarwala", "9822000016"]])
  batch.set(db.doc(`households/${hof}`), { hof, name, mobile, address: "", sectorId: "bur", whatsappConsent: true });

// shortcut: plain-text password, as requested for now (see login() in app/actions.ts for the upgrade path).
batch.set(db.doc(`users/${username}`), { username, password, name: "Husainin Baug Admin", mobile: "", email: "", role: "admin", sectorId: null, active: true }, { merge: true });
await batch.commit();
console.log(`Seeded 6 venues, ${sectors.length} sectors, 3 households, admin ${username}`);
