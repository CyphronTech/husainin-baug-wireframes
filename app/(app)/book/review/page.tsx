import { redirect } from "next/navigation";
import type { SP } from "@/lib/ui";

/** The old step 4. Function details are now step 2 and booking happens on step 3, so old links land there. */
export default async function BookReview({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  redirect(`/book/slots?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"))}`);
}
