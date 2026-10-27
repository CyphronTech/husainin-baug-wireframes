import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Credentials: GOOGLE_APPLICATION_CREDENTIALS (service account JSON) locally, or the emulator env vars.
const app = getApps()[0] ?? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
export const db = getFirestore(app);
