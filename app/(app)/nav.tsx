"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "@/lib/icons";

const ADMIN: [string, string, IconName][] = [
  ["/", "Dashboard", "home"], ["/book", "New booking", "calendarPlus"], ["/my-bookings", "All bookings", "list"], ["/venues", "Halls, Rooms & Sectors", "building"],
  ["/households", "Households", "family"], ["/payments", "Payments", "wallet"], ["/users", "Users", "user"],
  ["/miqaats", "Miqaat details", "star"], ["/expenses", "Expenses", "receipt"],
];
const SECTOR: [string, string, IconName][] = [["/", "Dashboard", "home"], ["/book", "New booking", "calendarPlus"], ["/my-bookings", "My bookings", "list"], ["/households", "Households", "family"]];

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
      {(admin ? ADMIN : SECTOR).map(([href, label, icon]) => (
        <Link key={href} href={href} aria-current={(href === "/" ? path === "/" : path === href || path.startsWith(href + "/")) ? "page" : undefined}><Icon name={icon} />{label}</Link>
      ))}
    </nav>
  );
}
