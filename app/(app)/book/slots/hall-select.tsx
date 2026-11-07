"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MultiSelect } from "@/lib/dropdown";
import { startNav } from "@/lib/nav-progress";

/** Shows the picked venues' rows in the calendar (none picked = all). The cart keeps slots from other venues, so options say what is picked there. */
export function HallSelect({ halls, options }: { halls: string[]; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <MultiSelect
      label="Halls & rooms"
      name="hall"
      empty="Choose halls or rooms"
      selected={halls}
      busy={pending}
      options={options.map((o) => ({ value: o.id, label: o.label }))}
      onChange={(picked) => {
        const next = new URLSearchParams(params);
        next.set("hall", picked.join(","));
        startNav();
        startTransition(() => router.push(`/book/slots?${next}`, { scroll: false }));
      }}
    />
  );
}
