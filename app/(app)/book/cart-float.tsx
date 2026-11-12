import Link from "next/link";
import { inr, SLOT_LABEL } from "@/lib/format";
import { Icon } from "@/lib/icons";
import type { DayEvent, Item } from "@/lib/types";

/** Cart pinned to the bottom right while another date is being entered, so what is already added stays in view. */
export function CartFloat({ items, days, dmy, href }: { items: Item[]; days: DayEvent[]; dmy: (d: string) => string; href: string }) {
  if (!items.length) return null;
  const dates = [...new Set(items.map((i) => i.date))].sort();
  const total = items.reduce((a, i) => a + i.rate, 0);
  return (
    <details className="cart-float" open>
      <summary>
        <Icon name="check" size={18} />
        <span>Cart · {items.length} {items.length === 1 ? "slot" : "slots"}</span>
        <b>{inr(total)}</b>
      </summary>
      <div className="cart-float-body">
        {dates.map((date) => {
          const ev = days.find((x) => x.date === date);
          return (
            <section key={date}>
              <h3>{dmy(date)}{ev && <span className="muted"> · {ev.purpose}</span>}</h3>
              <ul>
                {items.filter((i) => i.date === date).map((i) => (
                  <li key={i.venueId}><span>{i.venueName} <span className="muted">{SLOT_LABEL[i.slot]}</span></span><span>{inr(i.rate)}</span></li>
                ))}
              </ul>
            </section>
          );
        })}
        <Link className="btn btn-icon" href={href}><Icon name="back" />Back to cart</Link>
      </div>
    </details>
  );
}
