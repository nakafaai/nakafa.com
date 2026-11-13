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
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import { CurrencyText } from "@/components/marketing/about/pricing/currency";
import { SCHOOL_PRICING_HERD } from "@/components/marketing/school/features/cast";
import { SchoolAmount } from "@/components/marketing/school/pricing/price";
import { PricingCurrencySchema } from "@/lib/pricing/monthly";
import { formatSchoolPrice, formatStorage } from "@/lib/pricing/school";
import { Link } from "@/lib/routing/link";

/** The longest period a school pays for at once, whose discount each paid card shows. */
const LONGEST_PERIOD = 12;

/**
 * A plan's card on the seven rows its siblings share from `md`: its name, its price, each of its four
 * lines, and its action, so every row starts on one line across the cards however its words wrap. Pro,
 * the plan most schools fit, stands out with the brand ring.
 */
const planCardVariants = cva(
  "relative md:row-span-7 md:grid md:grid-rows-subgrid md:gap-y-3",
  {
    variants: {
      tier: {
        free: "",
        max: "",
        pro: "ring-primary ring-2",
      },
    },
  }
);

/** One line of a plan: its own icon and its text. */
function PlanLine({
  children,
  icon,
}: {
  children: ReactNode;
  icon: typeof UserGroupIcon;
}) {
  return (
    <li className="flex items-start gap-3 text-base leading-6 md:px-(--card-spacing)">
      <HugeIcons className="mt-1 shrink-0" icon={icon} />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

/**
 * A paid plan's price a month, and under it what a month costs when the school
 * pays for the longest period at once, so the discount of a longer period shows
 * in the card itself.
 */
function PaidPrice({ tier }: { tier: SchoolPaidTierKey }) {
  const t = useTranslations("SchoolSite");
  const monthly = schoolTiers[tier].monthly;

  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 whitespace-nowrap">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">
          <SchoolAmount amounts={monthly} />
        </span>
        <span className="text-muted-foreground">{t("plan-month")}</span>
      </p>
      <p className="text-muted-foreground text-sm text-pretty tabular-nums">
        {Arr.map(PricingCurrencySchema.literals, (currency) => (
          <CurrencyText currency={currency} key={currency}>
            {t("plan-yearly", {
              price: formatSchoolPrice(
                currency,
                schoolMonthlyAfterDiscount(monthly[currency], LONGEST_PERIOD)
              ),
            })}
          </CurrencyText>
        ))}
      </p>
    </>
  );
}

/** The trial's price: free for its days, with no payment and no card. */
function TrialPrice() {
  const t = useTranslations("SchoolSite");

  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 whitespace-nowrap">
        <span className="text-4xl font-semibold tracking-tight">
          {t("plan-free-price")}
        </span>
        <span className="text-muted-foreground">
          {t("plan-trial-for", { days: SCHOOL_TRIAL_DAYS })}
        </span>
      </p>
      <p className="text-muted-foreground text-sm">{t("plan-billed-free")}</p>
    </>
  );
}

/**
 * One plan's card in four rows: its name, its price, what it holds, and its
 * action. Every plan starts the free trial: a school opens on Gratis and
 * upgrades inside its settings, so Pro's action is the page's one primary
 * button.
 */
function SchoolPlanCard({ tier }: { tier: SchoolTierKey }) {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const plan = schoolTiers[tier];

  return (
    <Card className={planCardVariants({ tier })} data-school-plan={tier}>
      <CardHeader className="md:mb-3">
        <h2 className="text-xl font-medium tracking-tight">
          {t(`plan-${tier}`)}
        </h2>
      </CardHeader>
      <CardContent className="grid content-start gap-1 md:mb-3">
        {tier === "free" ? <TrialPrice /> : <PaidPrice tier={tier} />}
      </CardContent>
      <CardContent className="md:contents">
        <ul className="grid gap-3 md:contents">
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
      <CardFooter className="md:mt-3">
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
 * The three School plans side by side from `md`, sharing seven rows so their
 * names, prices, each line and their actions line up, one under another on a
 * phone. Someone peeks over the top edge of every card: Nina drums behind Pro,
 * and an animal of the page's cast waits behind Gratis and Max at the other
 * end. Each card is drawn over who stands behind it, so its edge cuts them,
 * and the rows leave them room under the words above.
 */
export function SchoolPlans() {
  return (
    <div className="mt-10 grid w-full gap-x-4 gap-y-18 md:grid-cols-3 md:grid-rows-[repeat(7,auto)] md:gap-y-6">
      <PlanStand>
        <PlanAnimal index={12} />
        <SchoolPlanCard tier="free" />
      </PlanStand>
      <PlanStand>
        <span className="absolute end-6 bottom-[calc(100%-0.5rem)]">
          <Nina act="drumming" label="" lean="peek" size={72} />
        </span>
        <SchoolPlanCard tier="pro" />
      </PlanStand>
      <PlanStand>
        <PlanAnimal index={13} />
        <SchoolPlanCard tier="max" />
      </PlanStand>
    </div>
  );
}

/** The column of one plan, which holds its card and whoever peeks over it, on the plans' shared rows. */
function PlanStand({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid md:row-span-7 md:grid-rows-subgrid md:gap-y-3">
      {children}
    </div>
  );
}

/**
 * One animal of the page's cast behind the start of a plan card's top edge, its lower part hidden by the card, so
 * the plan's action has a face over it as Pro's has Nina at the other end.
 */
function PlanAnimal({ index }: { index: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute start-6 bottom-[calc(100%-1rem)]"
    >
      <PersonAvatar
        className="size-14"
        mascot={Arr.getUnsafe(SCHOOL_PRICING_HERD, index)}
      />
    </span>
  );
}
