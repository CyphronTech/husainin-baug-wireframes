import type { QuerySnapshot } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { db } from "./firebase-admin";
import type { Household, Sector, Venue } from "./types";

export const rows = <T>(s: QuerySnapshot) => s.docs.map((d) => ({ id: d.id, ...d.data() }) as T);

export const readVenues = async () =>
  rows<Venue>(await db.collection("venues").get()).sort((a, b) => a.type.localeCompare(b.type) || b.capacity - a.capacity || a.name.localeCompare(b.name));

export const readSectors = async () => rows<Sector>(await db.collection("sectors").get()).sort((a, b) => a.name.localeCompare(b.name));

// Page reads: cached per server instance. Saves bust it via updateTag; revalidate bounds staleness on other instances.
export const getVenues = unstable_cache(readVenues, ["venues"], { tags: ["venues"], revalidate: 300 });
export const getSectors = unstable_cache(readSectors, ["sectors"], { tags: ["sectors"], revalidate: 300 });

// shortcut: households are loaded per sector (or all, for admin) and searched in memory. Fine to ~10k households.
export const getHouseholds = async (sectorId?: string) =>
  rows<Household>(await (sectorId ? db.collection("households").where("sectorId", "==", sectorId) : db.collection("households")).get()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
