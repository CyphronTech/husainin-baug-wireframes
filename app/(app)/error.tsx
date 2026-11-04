"use client";

import Link from "next/link";

/** A failed page load (e.g. Firestore unreachable) keeps the app's nav instead of a blank error screen. */
export default function PageError({ retry }: { retry: () => void }) {
  return (
    <div className="card stack">
      <h1 className="m0">Something went wrong</h1>
      <p className="muted m0">This page could not be loaded. Nothing was changed.</p>
      <div className="row"><button className="btn primary" onClick={() => retry()}>Try again</button><Link className="btn" href="/">Go to dashboard</Link></div>
    </div>
  );
}
