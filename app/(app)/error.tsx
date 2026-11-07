"use client";

import { Icon } from "@/lib/icons";
import Link from "next/link";

/** A failed page load (e.g. Firestore unreachable) keeps the app's nav instead of a blank error screen. */
export default function PageError({ retry }: { retry: () => void }) {
  return (
    <div className="card stack">
      <h1 className="m0">Something went wrong</h1>
      <p className="muted m0">This page could not be loaded. Nothing was changed.</p>
      <div className="row"><button className="btn primary btn-icon" onClick={() => retry()}><Icon name="refresh" />Try again</button><Link className="btn btn-icon" href="/"><Icon name="home" />Go to dashboard</Link></div>
    </div>
  );
}
