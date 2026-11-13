import { MinusSignIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import {
  SCHOOL_TRIAL_DAYS,
  SchoolPeriod,
  SchoolTierKey,
  schoolAccount,
  schoolPeriodDiscounts,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { formatBytes } from "@repo/internationalization/src/formats";
import { cva } from "class-variance-authority";
import { Array as Arr, Match, Option, Result } from "effect";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { SchoolAmount } from "@/components/marketing/school/pricing/price";

/** The rows of every group, one line each; the capacity and billing rows differ by plan, the rest are in every plan. */
const COMPARE_GROUPS = [
  {
    group: "capacity",
    rows: ["accounts", "credits", "storage", "added", "access"],
  },
  { group: "classroom", rows: ["forum", "library", "tasks"] },
  { group: "assessment", rows: ["exams", "tryouts", "reports"] },
  {
    group: "school",
    rows: ["insight", "graduation", "parents", "nina", "languages"],
  },
  { group: "billing", rows: ["periods", "discount", "payment"] },
] as const;

type CompareRow = (typeof COMPARE_GROUPS)[number]["rows"][number];

/** The plan a phone shows beside each feature until the reader picks another: the plan most schools fit. */
const PHONE_PLAN: SchoolTierKey = "pro";

/**
 * One plan's cell. From `md` every plan has its column; on a phone only the
 * plan the reader picked shows, beside the feature, so its value has half the
 * width instead of a third. The table's `data-plan` names that plan.
 */
const planCellVariants = cva(
  "py-3.5 text-sm text-pretty tabular-nums max-md:text-right md:px-3 md:text-center md:text-base",
  {
    variants: {
      tier: {
        free: "max-md:group-data-[plan=max]/compare:hidden max-md:group-data-[plan=pro]/compare:hidden",
        max: "max-md:group-data-[plan=free]/compare:hidden max-md:group-data-[plan=pro]/compare:hidden",
        pro: "max-md:group-data-[plan=free]/compare:hidden max-md:group-data-[plan=max]/compare:hidden",
      },
    },
  }
);

/** The mark of a feature a plan holds, named for a screen reader. */
function Included() {
  const t = useTranslations("SchoolSite");

  return (
    <>
      <HugeIcons
        aria-hidden="true"
        className="text-primary inline size-5"
        icon={Tick02Icon}
      />
      <span className="sr-only">{t("value-included")}</span>
    </>
  );
}

/** The mark of a feature a plan does not hold: a quiet dash, named for a screen reader. */
function Unavailable() {
  const t = useTranslations("SchoolSite");

  return (
    <>
      <HugeIcons
        aria-hidden="true"
        className="text-muted-foreground inline size-4"
        icon={MinusSignIcon}
      />
      <span className="sr-only">{t("value-unavailable")}</span>
    </>
  );
}

/** The discount of every period that has one, such as 3% for 6 months and 5% for 12, from the billing source. */
function PeriodDiscounts() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();

  return format.list(
    Arr.filterMap(SchoolPeriod.literals, (months) => {
      const percent = schoolPeriodDiscounts[months];
      return percent > 0
        ? Result.succeed(t("value-discount", { months, percent }))
        : Result.failVoid;
    })
  );
}

/** What one plan holds on one row. */
function CompareValue({ row, tier }: { row: CompareRow; tier: SchoolTierKey }) {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const format = useFormatter();
  const plan = schoolTiers[tier];
  const free = tier === "free";

  return Match.value(row).pipe(
    Match.when("accounts", () => format.number(plan.accounts)),
    Match.when("credits", () =>
      t(plan.creditsRenew ? "value-month" : "value-once", {
        count: plan.credits,
      })
    ),
    Match.when("storage", () =>
      formatBytes(plan.storageMegabytes * 1_000_000, locale)
    ),
    Match.when("added", () =>
      free ? (
        <Unavailable />
      ) : (
        <>
          <SchoolAmount amounts={schoolAccount.monthly} /> {t("value-unit")}
        </>
      )
    ),
    Match.when("access", () =>
      free ? t("value-trial", { days: SCHOOL_TRIAL_DAYS }) : t("value-ongoing")
    ),
    Match.when("periods", () =>
      free ? <Unavailable /> : t("value-periods-paid")
    ),
    Match.when("discount", () =>
      free ? <Unavailable /> : <PeriodDiscounts />
    ),
    Match.when("payment", () =>
      t(free ? "value-payment-free" : "value-payment-paid")
    ),
    Match.orElse(() => <Included />)
  );
}

/** One row: the feature's name, then what each plan holds, on one hairline. */
function CompareLine({ row }: { row: CompareRow }) {
  const t = useTranslations("SchoolSite");

  return (
    <tr className="border-b">
      <th
        className="py-3.5 pr-4 text-left text-sm font-normal text-pretty md:text-base"
        scope="row"
      >
        {t(`row.${row}`)}
      </th>
      {Arr.map(SchoolTierKey.literals, (tier) => (
        <td className={planCellVariants({ tier })} key={tier}>
          <CompareValue row={row} tier={tier} />
        </td>
      ))}
    </tr>
  );
}

/** One group of rows under its name and the one sentence that says what it covers. */
function CompareGroup({ group }: { group: (typeof COMPARE_GROUPS)[number] }) {
  const t = useTranslations("SchoolSite");

  return (
    <tbody>
      <tr className="border-b">
        <th
          className="pt-12 pb-3 text-left font-normal"
          colSpan={4}
          scope="rowgroup"
        >
          <span className="block text-lg font-medium tracking-tight">
            {t(`group.${group.group}`)}
          </span>
          <span className="text-muted-foreground block text-sm text-pretty">
            {t(`group-${group.group}-text`)}
          </span>
        </th>
      </tr>
      {Arr.map(group.rows, (row) => (
        <CompareLine key={row} row={row} />
      ))}
    </tbody>
  );
}

/** One plan's head in the pinned row: its name. What it holds is in the rows under it. */
function PlanHead({ tier }: { tier: SchoolTierKey }) {
  const t = useTranslations("SchoolSite");

  return (
    <th
      className="px-3 py-3 text-center text-base font-medium tracking-tight"
      scope="col"
    >
      {t(`plan.${tier}`)}
    </th>
  );
}

/** Reads a toggle's value back as a plan, or none for an emptied group. */
function readTier(value: string) {
  return Arr.findFirst(SchoolTierKey.literals, (tier) => tier === value);
}

/**
 * The comparison of every plan as one table: groups that say what they cover,
 * one hairline per row, a check for what a plan holds and a dash for what it
 * does not. While the reader scrolls, the plan names stay pinned under the site
 * header, and the heads hold the names alone, since the rows say what each plan
 * holds. A phone has no room for three columns, so a pinned switch of three
 * equal segments picks the plan that shows beside each feature, and every value
 * keeps half the width.
 */
export function SchoolCompare() {
  const t = useTranslations("SchoolSite");
  const [plan, setPlan] = useState(PHONE_PLAN);

  return (
    <section
      aria-labelledby="school-compare-title"
      className="scroll-mt-16 px-6 py-20 lg:px-10 lg:py-32"
      id="compare"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <h2
          className="text-center text-3xl tracking-tight text-balance sm:text-4xl"
          id="school-compare-title"
        >
          {t("compare-title")}
        </h2>
        <div>
          <div className="bg-background sticky top-16 z-10 py-3 md:hidden">
            <ToggleGroup
              aria-label={t("compare-pick")}
              gridColumns="2"
              layout="grid"
              onValueChange={(value) => Option.map(readTier(value), setPlan)}
              value={plan}
            >
              {Arr.map(SchoolTierKey.literals, (tier) => (
                <ToggleGroupItem key={tier} value={tier}>
                  {t(`plan.${tier}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <table
            aria-labelledby="school-compare-title"
            className="group/compare w-full border-collapse md:table-fixed"
            data-plan={plan}
          >
            <thead className="bg-background sticky top-16 z-10 max-md:sr-only">
              <tr className="border-b">
                <th className="py-3 text-left md:w-2/5" scope="col">
                  <span className="sr-only">{t("compare-feature")}</span>
                </th>
                {Arr.map(SchoolTierKey.literals, (tier) => (
                  <PlanHead key={tier} tier={tier} />
                ))}
              </tr>
            </thead>
            {Arr.map(COMPARE_GROUPS, (group) => (
              <CompareGroup group={group} key={group.group} />
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}
