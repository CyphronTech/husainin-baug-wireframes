// Firebase Auth REST (Identity Toolkit). Sign-in happens server-side so the browser never needs the Firebase SDK
// and a mobile number can be resolved to its account email without exposing that email.
const base = () =>
  `${process.env.FIREBASE_AUTH_EMULATOR_HOST ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/` : "https://"}identitytoolkit.googleapis.com/v1/accounts`;

async function call(method: string, body: object) {
  const res = await fetch(`${base()}:${method}?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message ?? "Auth request failed");
  return j;
}

export const signInWithPassword = async (email: string, password: string): Promise<string> =>
  (await call("signInWithPassword", { email, password, returnSecureToken: true })).idToken;

/** Firebase sends the email itself; for a new user it doubles as "set your password". */
export const sendPasswordEmail = (email: string) => call("sendOobCode", { requestType: "PASSWORD_RESET", email });
