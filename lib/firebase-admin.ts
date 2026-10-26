import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Credentials: ADC on App Hosting, GOOGLE_APPLICATION_CREDENTIALS locally, or emulator env vars.
const app = getApps()[0] ?? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
export const db = getFirestore(app);
export const auth = getAuth(app);
