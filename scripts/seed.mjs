// One-time setup: venues, sectors, demo households and the first admin (users/{username}).
//   node --env-file=.env.local scripts/seed.mjs            → admin 50450028 / Password
//   node --env-file=.env.local scripts/seed.mjs <username> <password>
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { VENUES } from "./venues.mjs";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS is empty. Put the service account JSON path in .env.local, e.g.\n  GOOGLE_APPLICATION_CREDENTIALS=C:/keys/husainin-sa.json\n(and make sure there is no second, empty GOOGLE_APPLICATION_CREDENTIALS= line below it)");
  process.exit(1);
}
const [username = "50450028", password = "Password"] = process.argv.slice(2);
initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore();
const batch = db.batch();

for (const v of VENUES)
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
console.log(`Seeded ${VENUES.length} venues, ${sectors.length} sectors, 3 households, admin ${username}`);
