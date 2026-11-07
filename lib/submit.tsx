"use client";

import { useFormStatus } from "react-dom";

/** Submit button that disables itself while the server action runs, so a slow save can't be sent twice. */
export function Submit({ children, disabled, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...p} disabled={disabled || pending} aria-busy={pending}>
      {pending ? <><span className="spinner" aria-hidden="true" />Please wait…</> : children}
    </button>
  );
}
