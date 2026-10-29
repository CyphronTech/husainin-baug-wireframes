import type { QuerySnapshot } from "firebase-admin/firestore";
import { db } from "./firebase-admin";
import type { Household, Sector, Venue } from "./types";

export const rows = <T>(s: QuerySnapshot) => s.docs.map((d) => ({ id: d.id, ...d.data() }) as T);

// Venues and sectors are read on nearly every request and change rarely, so they're cached in this server process.
// shortcut: per-process, 60 s. Saves on this server clear it at once; with several server instances another instance
// can show stale venues/sectors for up to 60 s. Upgrade: Next "use cache" + revalidateTag, or a shared cache.
const store = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>, ttl = 60_000): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.delete(key)); // never cache a failure
  return value;
}
export const invalidate = (key: "venues" | "sectors") => store.delete(key);

export const getVenues = () =>
  cached("venues", async () =>
    rows<Venue>(await db.collection("venues").get()).sort((a, b) => a.type.localeCompare(b.type) || b.capacity - a.capacity || a.name.localeCompare(b.name)),
  );

export const getSectors = () => cached("sectors", async () => rows<Sector>(await db.collection("sectors").get()).sort((a, b) => a.name.localeCompare(b.name)));

// shortcut: households are loaded per sector (or all, for admin) and searched in memory. Fine to ~10k households.
export const getHouseholds = async (sectorId?: string) =>
  rows<Household>(await (sectorId ? db.collection("households").where("sectorId", "==", sectorId) : db.collection("households")).get()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
