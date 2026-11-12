import { setVenuesActive } from "@/app/actions";
import { Switch } from "@/lib/switch";

/** Open/closed switch for a hall or a whole room type. */
export function OnOff({ ids, on, label }: { ids: string[]; on: boolean; label: string }) {
  return <Switch action={setVenuesActive} fields={{ ids: ids.join(",") }} on={on} label={label} onText="Open" offText="Closed" />;
}
