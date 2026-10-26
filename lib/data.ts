import type { QuerySnapshot } from "firebase-admin/firestore";
import { db } from "./firebase-admin";
import type { Sector, Venue } from "./types";

export const rows = <T>(s: QuerySnapshot) => s.docs.map((d) => ({ id: d.id, ...d.data() }) as T);

export const getVenues = async () =>
  rows<Venue>(await db.collection("venues").get()).sort((a, b) => a.type.localeCompare(b.type) || b.capacity - a.capacity || a.name.localeCompare(b.name));

export const getSectors = async () => rows<Sector>(await db.collection("sectors").get()).sort((a, b) => a.name.localeCompare(b.name));
