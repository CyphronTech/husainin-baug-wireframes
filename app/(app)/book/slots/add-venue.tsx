"use client";

import Link from "next/link";
import { useRef } from "react";

/** "+ Add hall" button: opens a small popup listing the halls and rooms not yet in the calendar; picking one adds its row. */
export function AddVenue({ options }: { options: { href: string; name: string; sub: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button type="button" className="btn" onClick={() => ref.current?.showModal()}>+ Add hall or room</button>
      <dialog ref={ref} className="modal" aria-labelledby="add-venue-title" onClick={(e) => e.target === ref.current && close()}>
        <div className="modal-form">
          <button type="button" className="modal-x" aria-label="Close" onClick={close}>×</button>
          <h2 id="add-venue-title">Add a hall or room</h2>
          <p className="muted mb-3">Its slots show as another row in the calendar.</p>
          <div className="venue-pick">
            {options.map((o) => (
              <Link key={o.href} prefetch={false} scroll={false} href={o.href} onClick={close}>
                <b>{o.name}</b><span className="muted">{o.sub}</span>
              </Link>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
