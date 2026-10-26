import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

// Lazy so the login page can prerender at build time without Firebase env vars.
export function clientAuth() {
  const auth = getAuth(
    getApps()[0] ??
      initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      }),
  );
  if (process.env.NEXT_PUBLIC_AUTH_EMULATOR && !auth.emulatorConfig) connectAuthEmulator(auth, process.env.NEXT_PUBLIC_AUTH_EMULATOR, { disableWarnings: true });
  return auth;
}
