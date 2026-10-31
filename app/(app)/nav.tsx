"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const ADMIN = [
  ["/", "Dashboard"], ["/bookings", "Booking options"], ["/book", "New booking"], ["/my-bookings", "All bookings"], ["/venues", "Halls & Rooms"],
  ["/sectors", "Sectors / Mohallas"], ["/households", "Households"], ["/payments", "Payments"], ["/users", "Users"],
  ["/cancellations", "Cancellation approval"], ["/miqaats", "Miqaat details"], ["/expenses", "Expenses"],
];
const SECTOR = [["/", "Dashboard"], ["/book", "New booking"], ["/my-bookings", "My bookings"], ["/households", "Households"], ["/cancellations", "Cancellations"]];

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  // On phones the nav is a sideways strip: bring the current page's link into view. No-op on desktop (nothing to scroll).
  useEffect(() => {
    const n = nav.current, a = n?.querySelector<HTMLElement>('[aria-current="page"]');
    if (n && a) n.scrollLeft = a.offsetLeft - (n.clientWidth - a.offsetWidth) / 2;
  }, [path]);
  return (
    <nav ref={nav}>
      {(admin ? ADMIN : SECTOR).map(([href, label]) => (
        <Link key={href} href={href} aria-current={(href === "/" ? path === "/" : path === href || path.startsWith(href + "/")) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
