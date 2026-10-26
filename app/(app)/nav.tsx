"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN = [
  ["/", "Dashboard"], ["/bookings", "Booking options"], ["/venues", "Halls & Rooms"], ["/sectors", "Sectors / Mohallas"],
  ["/payments", "Payments"], ["/users", "Users"], ["/cancellations", "Cancellation approval"], ["/miqaats", "Miqaat details"],
];
const SECTOR = [["/bookings", "Booking options"]];

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  return (
    <nav>
      {(admin ? ADMIN : SECTOR).map(([href, label]) => (
        <Link key={href} href={href} className={(href === "/" ? path === "/" : path.startsWith(href)) ? "on" : ""}>{label}</Link>
      ))}
    </nav>
  );
}
