import {
  CheckmarkBadge01Icon,
  CloudServerIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import {
  SCHOOL_TRIAL_DAYS,
  type SchoolPaidTierKey,
  type SchoolTierKey,
  schoolMonthlyAfterDiscount,
  schoolPeriodTotal,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cva } from "class-variance-authority";
import { Record as Rec } from "effect";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useSchoolPeriod } from "@/components/marketing/school/period";
import { SchoolAmount } from "@/components/marketing/school/price";
import { formatStorage } from "@/lib/pricing/school";
import { Link } from "@/lib/routing/link";

/** The ring of a plan's card: Pro, the plan most schools fit, stands out with the brand ring. */
const planCardVariants = cva("md:row-span-4 md:grid md:grid-rows-subgrid", {
  variants: {
    tier: {
      free: "",
      max: "",
      pro: "ring-primary ring-2",
    },
  },
});

/** One line of a plan: its own icon and its text. */
function PlanLine({
  children,
  icon,
}: {
  children: ReactNode;
  icon: typeof UserGroupIcon;
}) {
  return (
    <li className="flex items-start gap-3 text-base leading-6">
      <HugeIcons className="mt-1 size-4 shrink-0" icon={icon} />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

/** A paid plan's price a month after the period's discount, and the invoice of the whole period under it. */
function PaidPrice({ tier }: { tier: SchoolPaidTierKey }) {
  const t = useTranslations("SchoolSite");
  const period = useSchoolPeriod((state) => state.period);
  const monthly = schoolTiers[tier].monthly;

  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 whitespace-nowrap">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">
          <SchoolAmount
            amounts={Rec.map(monthly, (amount) =>
              schoolMonthlyAfterDiscount(amount, period)
            )}
          />
        </span>
        <span className="text-muted-foreground">{t("plan-month")}</span>
      </p>
      <p className="text-muted-foreground text-sm text-pretty tabular-nums">
        <SchoolAmount
          amounts={Rec.map(monthly, (amount) =>
            schoolPeriodTotal(amount, period)
          )}
        />{" "}
        {t("plan-billed", { months: period })}
      </p>
    </>
  );
}

/** The trial's price: free for its days, with no payment and no card. */
function TrialPrice() {
  const t = useTranslations("SchoolSite");

  return (
    <>
      <p className="text-4xl font-semibold tracking-tight">
        {t("plan-trial", { days: SCHOOL_TRIAL_DAYS })}
      </p>
      <p className="text-muted-foreground text-sm">{t("plan-billed-free")}</p>
    </>
  );
}

/**
 * One plan's card in four rows: its name and who it fits, its price, what it
 * holds, and its action. Every plan starts the free trial: a school opens on
 * Gratis and upgrades inside its settings, so Pro's action is the page's one
 * primary button.
 */
function SchoolPlanCard({ tier }: { tier: SchoolTierKey }) {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const plan = schoolTiers[tier];

  return (
    <Card className={planCardVariants({ tier })} data-school-plan={tier}>
      <CardHeader>
        <h3 className="text-xl font-medium tracking-tight">
          {t(`plan-${tier}`)}
        </h3>
        <p className="text-muted-foreground">{t(`plan-${tier}-description`)}</p>
      </CardHeader>
      <CardContent className="grid content-start gap-1">
        {tier === "free" ? <TrialPrice /> : <PaidPrice tier={tier} />}
      </CardContent>
      <CardContent>
        <ul className="grid gap-3">
          <PlanLine icon={UserGroupIcon}>
            {t("plan-accounts", { count: plan.accounts })}
          </PlanLine>
          <PlanLine icon={SparklesIcon}>
            {t(plan.creditsRenew ? "plan-credits-month" : "plan-credits-once", {
              count: plan.credits,
            })}
          </PlanLine>
          <PlanLine icon={CloudServerIcon}>
            {t("plan-storage", {
              size: formatStorage(plan.storageMegabytes, locale),
            })}
          </PlanLine>
          <PlanLine icon={CheckmarkBadge01Icon}>
            {t("plan-everything")}
          </PlanLine>
        </ul>
      </CardContent>
      <CardFooter>
        <Link
          className={buttonVariants({
            className: "w-full",
            variant: tier === "pro" ? "default" : "outline",
          })}
          to="/$locale/school/new"
        >
          {tier === "free"
            ? t("plan-start")
            : t("plan-choose", { plan: t(`plan-${tier}`) })}
        </Link>
      </CardFooter>
    </Card>
  );
}

/**
 * The three School plans side by side from `md`, sharing four rows so their
 * prices, lists and actions line up, one under another on a phone. The prices
 * follow the page's billing period.
 */
export function SchoolPlans() {
  return (
    <div className="grid w-full gap-4 md:grid-cols-3 md:grid-rows-[auto_auto_1fr_auto] md:gap-y-6">
      <SchoolPlanCard tier="free" />
      <SchoolPlanCard tier="pro" />
      <SchoolPlanCard tier="max" />
    </div>
  );
}
