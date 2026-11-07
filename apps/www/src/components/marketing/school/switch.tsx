import {
  SchoolPeriod,
  schoolPeriodDiscounts,
} from "@repo/backend/confect/billing/tiers";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr, Option } from "effect";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import {
  createSchoolPeriod,
  SchoolPeriodContext,
  useSchoolPeriod,
} from "@/components/marketing/school/period";

/** Creates the period of one pricing page and shares it with the plans and the calculator. */
export function SchoolPeriodProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSchoolPeriod);
  return <SchoolPeriodContext value={store}>{children}</SchoolPeriodContext>;
}

/** Reads a toggle's value back as a period, or none for an emptied group. */
function readPeriod(value: string) {
  return Arr.findFirst(
    SchoolPeriod.literals,
    (period) => String(period) === value
  );
}

/** One period's label, with what it saves when it saves anything. */
function PeriodLabel({ period }: { period: SchoolPeriod }) {
  const t = useTranslations("SchoolSite");
  const discount = schoolPeriodDiscounts[period];

  return (
    <>
      {t("period-option", { months: period })}
      {discount > 0 ? (
        <Badge variant="default-subtle">
          {t("period-save", { percent: discount })}
        </Badge>
      ) : null}
    </>
  );
}

/**
 * The switch of the billing period: monthly, 3, 6 or 12 months, each longer
 * period with its saving beside its name. Every price on the page follows it.
 */
export function SchoolPeriodSwitch() {
  const t = useTranslations("SchoolSite");
  const period = useSchoolPeriod((state) => state.period);
  const setPeriod = useSchoolPeriod((state) => state.setPeriod);

  return (
    <ToggleGroup
      aria-label={t("period-label")}
      className="mx-auto flex-wrap justify-center"
      onValueChange={(value) => Option.map(readPeriod(value), setPeriod)}
      value={String(period)}
    >
      {Arr.map(SchoolPeriod.literals, (option) => (
        <ToggleGroupItem key={option} value={String(option)}>
          <PeriodLabel period={option} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
