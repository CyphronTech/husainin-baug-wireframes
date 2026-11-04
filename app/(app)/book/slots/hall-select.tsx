"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/lib/dropdown";

/** Shows one venue's row in the calendar. The cart keeps slots from other venues, so options say what is picked there. */
export function HallSelect({ hall, options }: { hall: string; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      label="Hall or room"
      name="hall"
      defaultValue={hall}
      busy={pending}
      onChange={(value) => {
        const next = new URLSearchParams(params);
        next.set("hall", value);
        startTransition(() => router.push(`/book/slots?${next}`, { scroll: false }));
      }}
    >
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </Select>
  );
}
