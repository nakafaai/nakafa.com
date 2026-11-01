import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "use-intl";

/** The ID of one unit of the school, as the viewer lists it. */
export type UnitId = Ref.Returns<
  typeof tenancy.viewer.get
>["units"][number]["id"];

/**
 * Renders the choice of the unit whose periods and cohorts a settings page shows, in its
 * header's button group. It shows only when the school has more than one unit.
 */
export function SchoolUnitChoice({
  onChoose,
  unitId,
  units,
}: {
  onChoose: (unitId: UnitId) => void;
  unitId: UnitId;
  units: readonly { readonly id: UnitId; readonly name: string }[];
}) {
  const t = useTranslations("SchoolSettings");
  const items = Arr.map(units, (unit) => ({
    label: unit.name,
    value: unit.id,
  }));

  return (
    <Select
      items={items}
      onValueChange={(value) => {
        const chosen = Schema.decodeUnknownOption(Id("tenantUnits"))(value);
        if (Option.isSome(chosen)) {
          onChoose(chosen.value);
        }
      }}
      value={unitId}
    >
      <SelectTrigger
        aria-label={t("unit-choice")}
        className="w-auto max-w-28 @max-sm/header:max-w-16 @max-xs/header:max-w-10 sm:max-w-xs"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t("unit-choice")}</SelectLabel>
          {Arr.map(items, (item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
