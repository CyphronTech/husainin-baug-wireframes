"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";

/** Open/close behaviour shared by both dropdowns: outside click, focus leaving, Esc and Enter close it. */
function useDropdown() {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (refocus = false) => {
    if (!ref.current?.open) return;
    ref.current.open = false;
    if (refocus) ref.current.querySelector("summary")?.focus();
  };
  useEffect(() => {
    const outside = (e: Event) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return {
    ref,
    close,
    props: {
      onKeyDown: (e: React.KeyboardEvent) => {
        // preventDefault: Esc must not also close a popup around it, Enter must not submit the form.
        if (ref.current?.open && (e.key === "Escape" || (e.key === "Enter" && e.target !== ref.current.querySelector("summary")))) {
          e.preventDefault();
          close(true);
        }
      },
      onBlur: (e: React.FocusEvent) => {
        // A click inside a scrollable popup moves focus to the popup itself, which contains this dropdown. That isn't leaving.
        const to = e.relatedTarget as Node | null;
        if (to && ref.current && !ref.current.contains(to) && !to.contains(ref.current)) close();
      },
    },
  };
}

function Field({ label, ariaLabel, children }: { label?: string; ariaLabel?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="ms-field" role="group" aria-labelledby={label ? id : undefined} aria-label={ariaLabel}>
      {label && <span id={id}>{label}</span>}
      {children}
    </div>
  );
}

/** Pick one. Takes the same <option> children as a native select and submits the same `name` field. */
export function Select({ label, "aria-label": ariaLabel, name, form, defaultValue, busy, onChange, autoSubmit, children }: {
  label?: string;
  "aria-label"?: string;
  name: string;
  form?: string;
  defaultValue?: string | null;
  busy?: boolean;
  onChange?: (value: string) => void;
  /** Submit the form as soon as an option is picked (for "pick one to open" selects with no other fields). */
  autoSubmit?: boolean;
  children: React.ReactNode;
}) {
  const options = Children.toArray(children).flatMap((c) => {
    if (!isValidElement<{ value?: string; children?: React.ReactNode }>(c)) return [];
    const text = Children.toArray(c.props.children).join("");
    return [{ value: c.props.value ?? text, label: text }];
  });
  // Like a native select: a default that isn't an option falls back to the first option.
  const start = options.find((o) => o.value === (defaultValue ?? ""))?.value ?? options[0]?.value ?? "";
  const [value, setValue] = useState(start);
  const { ref, close, props } = useDropdown();
  // autoSubmit: a mouse pick or Enter submits; arrow keys only move through the list.
  const submit = () => {
    const f = ref.current?.querySelector("input")?.form;
    if (autoSubmit && f) requestAnimationFrame(() => f.requestSubmit()); // after React re-checks the radio
  };
  useEffect(() => setValue(start), [start]);
  useEffect(() => {
    // React resets a form after a server action. Controlled radios have to follow.
    const f = ref.current?.querySelector("input")?.form;
    const reset = () => setValue(start);
    f?.addEventListener("reset", reset);
    return () => f?.removeEventListener("reset", reset);
  }, [ref, start]);
  return (
    <Field label={label} ariaLabel={ariaLabel}>
      <details
        ref={ref}
        className="ms"
        aria-busy={busy}
        {...props}
        onKeyDown={(e) => {
          const pick = e.key === "Enter" && ref.current?.open && e.target instanceof HTMLInputElement;
          props.onKeyDown(e);
          if (pick) submit();
        }}
      >
        <summary>{options.find((o) => o.value === value)?.label}</summary>
        <div className="ms-panel">
          {options.map((o) => (
            // detail 0 is the click a browser fires for arrow keys: those change the value but keep the list open.
            <label key={o.value} className="check" onClick={(e) => { if (e.detail > 0 && e.target instanceof HTMLInputElement) (close(true), submit()); }}>
              <input
                type="radio"
                name={name}
                form={form}
                value={o.value}
                checked={o.value === value}
                onChange={() => {
                  setValue(o.value);
                  onChange?.(o.value);
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      </details>
    </Field>
  );
}

/** Pick several. Submits one `name` field per ticked option. */
export function MultiSelect({ label, name, empty, options, selected, busy, onChange }: {
  label: string;
  name: string;
  empty: string;
  options: { value: string; label: string }[];
  selected: string[];
  busy?: boolean;
  onChange?: (picked: string[]) => void;
}) {
  const [picked, setPicked] = useState(selected);
  const key = selected.join(",");
  useEffect(() => setPicked(key ? key.split(",") : []), [key]); // follow the URL when a link changes it
  const { ref, props } = useDropdown();
  const names = options.filter((o) => picked.includes(o.value)).map((o) => o.label);
  const toggle = (value: string, on: boolean) => {
    const next = on ? [...picked, value] : picked.filter((p) => p !== value);
    setPicked(next);
    onChange?.(next);
  };
  return (
    <Field label={label}>
      <details ref={ref} className="ms" aria-busy={busy} {...props}>
        <summary>{names.length === 0 ? empty : names.length <= 2 ? names.join(", ") : `${names.length} selected`}</summary>
        <div className="ms-panel">
          {options.map((o) => (
            <label key={o.value} className="check">
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={picked.includes(o.value)}
                onChange={(e) => toggle(o.value, e.target.checked)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </details>
    </Field>
  );
}
