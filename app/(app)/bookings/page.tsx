import { redirect } from "next/navigation";
import type { SP } from "@/lib/ui";

/** Booking options moved into /book. Keeps old links and bookmarks working. */
export default async function Bookings({ searchParams }: { searchParams: SP }) {
  redirect(`/book?${new URLSearchParams((await searchParams) as Record<string, string>)}`);
}
