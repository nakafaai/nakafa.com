import { Tick02Icon } from "@hugeicons/core-free-icons";
import {
  SCHOOL_TRIAL_DAYS,
  type SchoolTierKey,
  SchoolTierKey as SchoolTierKeySchema,
  schoolAccount,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Match } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { SchoolAmount } from "@/components/marketing/school/price";
import { formatStorage } from "@/lib/pricing/school";

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
  { group: "billing", rows: ["periods", "payment"] },
] as const;

type CompareRow = (typeof COMPARE_GROUPS)[number]["rows"][number];

/** The mark of a feature every plan holds, named for a screen reader. */
function Included() {
  const t = useTranslations("SchoolSite");

  return (
    <>
      <HugeIcons
        aria-hidden="true"
        className="text-primary mx-auto size-5"
        icon={Tick02Icon}
      />
      <span className="sr-only">{t("value-included")}</span>
    </>
  );
}

/** What one plan holds on one row. */
function CompareValue({ row, tier }: { row: CompareRow; tier: SchoolTierKey }) {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const plan = schoolTiers[tier];
  const free = tier === "free";

  return Match.value(row).pipe(
    Match.when("accounts", () =>
      new Intl.NumberFormat(locale).format(plan.accounts)
    ),
    Match.when("credits", () =>
      t(plan.creditsRenew ? "value-month" : "value-once", {
        count: plan.credits,
      })
    ),
    Match.when("storage", () => formatStorage(plan.storageMegabytes, locale)),
    Match.when("added", () =>
      free ? (
        t("value-unavailable")
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
      t(free ? "value-periods-free" : "value-periods-paid")
    ),
    Match.when("payment", () =>
      t(free ? "value-payment-free" : "value-payment-paid")
    ),
    Match.orElse(() => <Included />)
  );
}

/**
 * One row: the feature's name, then what each plan holds. From `sm` it is a
 * table row of four cells; on a phone the row becomes a three-column grid, the
 * name on its own line above the three values, so each value has a third of the
 * width and no cell scrolls sideways.
 */
function CompareLine({ row }: { row: CompareRow }) {
  const t = useTranslations("SchoolSite");

  return (
    <tr className="border-b max-sm:grid max-sm:grid-cols-3 max-sm:gap-x-2 max-sm:py-3">
      <th
        className="text-left text-base font-normal max-sm:col-span-3 max-sm:pb-2 max-sm:text-sm max-sm:font-medium sm:py-3 sm:pr-4"
        scope="row"
      >
        {t(`row-${row}`)}
      </th>
      {Arr.map(SchoolTierKeySchema.literals, (tier) => (
        <td
          className="text-muted-foreground text-center text-sm text-pretty tabular-nums sm:px-2 sm:py-3 sm:text-base"
          key={tier}
        >
          <CompareValue row={row} tier={tier} />
        </td>
      ))}
    </tr>
  );
}

/** One group of rows under its name, which spans the table. */
function CompareGroup({ group }: { group: (typeof COMPARE_GROUPS)[number] }) {
  const t = useTranslations("SchoolSite");

  return (
    <tbody className="max-sm:block">
      <tr className="max-sm:block">
        <th
          className="pt-10 pb-2 text-left text-lg font-medium tracking-tight max-sm:block"
          colSpan={4}
          scope="rowgroup"
        >
          {t(`group-${group.group}`)}
        </th>
      </tr>
      {Arr.map(group.rows, (row) => (
        <CompareLine key={row} row={row} />
      ))}
    </tbody>
  );
}

/**
 * The comparison of every plan as one table: grouped rows, one line per row,
 * and the plan names held under the site header while the reader scrolls. On a
 * phone each row folds the feature's name into a line above its values instead
 * of scrolling sideways.
 */
export function SchoolCompare() {
  const t = useTranslations("SchoolSite");

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
        <table
          aria-labelledby="school-compare-title"
          className="w-full border-collapse max-sm:block sm:table-fixed"
        >
          <thead className="bg-background sticky top-16 z-10 max-sm:block">
            <tr className="border-b max-sm:grid max-sm:grid-cols-3 max-sm:gap-x-2">
              <th className="py-3 text-left max-sm:hidden sm:w-2/5" scope="col">
                <span className="sr-only">{t("compare-feature")}</span>
              </th>
              {Arr.map(SchoolTierKeySchema.literals, (tier) => (
                <th
                  className="py-3 text-center text-base font-medium tracking-tight sm:px-2 sm:text-lg"
                  key={tier}
                  scope="col"
                >
                  {t(`plan-${tier}`)}
                </th>
              ))}
            </tr>
          </thead>
          {Arr.map(COMPARE_GROUPS, (group) => (
            <CompareGroup group={group} key={group.group} />
          ))}
        </table>
      </div>
    </section>
  );
}
