import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Credentials: GOOGLE_APPLICATION_CREDENTIALS (service account JSON) locally, or the emulator env vars.
const existing = getApps()[0];
const app = existing ?? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
export const db = getFirestore(app);
// REST, not gRPC: the gRPC channel stalled 15–55 s on some reads from this network. settings() may only run once per instance.
if (!existing) db.settings({ preferRest: true });
