"use client";

import { useState } from "react";

/** Purpose chips. "Other" shows a required "What is the event?" box, so a blank one can't be submitted. Fields post with form "book". */
export function Purpose({ options, initial, initialOther }: { options: string[]; initial: string; initialOther: string }) {
  const [purpose, setPurpose] = useState(initial);
  return (
    <>
      <fieldset className="purpose">
        <legend>Purpose</legend>
        {options.map((p) => (
          <label key={p}><input type="radio" name="purpose" value={p} form="book" checked={purpose === p} onChange={() => setPurpose(p)} />{p}</label>
        ))}
      </fieldset>
      {purpose === "Other" && (
        <label className="purpose-other">What is the event?<input name="purposeOther" form="book" required maxLength={60} defaultValue={initialOther} placeholder="e.g. Aqeeqah, Birthday" /></label>
      )}
    </>
  );
}
