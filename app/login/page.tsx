"use client";

import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { clientAuth } from "@/lib/firebase-client";

export default function Login() {
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMsg("");
    try {
      const { user } = await signInWithEmailAndPassword(clientAuth(), String(f.get("email")), String(f.get("password")));
      const res = await fetch("/api/session", { method: "POST", body: JSON.stringify({ idToken: await user.getIdToken() }) });
      if (!res.ok) throw new Error((await res.json()).error);
      await clientAuth().signOut(); // server session cookie is the only session from here on
      location.href = "/";
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function forgot() {
    const email = (document.querySelector("input[name=email]") as HTMLInputElement).value;
    if (!email) return setMsg("Enter your email first");
    await sendPasswordResetEmail(clientAuth(), email).catch(() => {});
    setMsg("If that email has an account, a reset link is on its way.");
  }

  return (
    <main className="login">
      <form className="card" onSubmit={onSubmit}>
        <h1>Husainin Baug</h1>
        <p className="muted">Hall &amp; Room Booking</p>
        <label>Email<input name="email" type="email" required autoFocus /></label>
        <label>Password<input name="password" type="password" required /></label>
        {msg && <p className="msg">{msg}</p>}
        <button className="btn primary">Sign in</button>
        <button type="button" className="link" onClick={forgot}>Forgot password?</button>
      </form>
    </main>
  );
}
