"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN = [
  ["/", "Dashboard"], ["/bookings", "Booking options"], ["/book", "New booking"], ["/my-bookings", "All bookings"], ["/venues", "Halls & Rooms"],
  ["/sectors", "Sectors / Mohallas"], ["/households", "Households"], ["/payments", "Payments"], ["/users", "Users"],
  ["/cancellations", "Cancellation approval"], ["/miqaats", "Miqaat details"],
];
const SECTOR = [["/", "Dashboard"], ["/book", "New booking"], ["/my-bookings", "My bookings"], ["/households", "Households"], ["/cancellations", "Cancellations"]];

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  return (
    <nav>
      {(admin ? ADMIN : SECTOR).map(([href, label]) => (
        <Link key={href} href={href} aria-current={(href === "/" ? path === "/" : path === href || path.startsWith(href + "/")) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
