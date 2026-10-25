import {
  BookOpen01Icon,
  CustomerSupportIcon,
  Diamond02Icon,
  SparklesIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { CurrencyBranch } from "@/components/marketing/about/pricing/currency";
import { getProPricingDisplay } from "@/components/marketing/about/pricing/display";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import type { useBillingNavigation } from "@/lib/billing/checkout";
import { isActiveLocale } from "@/lib/i18n/active";
import { proPlanFeatures } from "@/lib/marketing/plan";
import { PricingCurrencySchema } from "@/lib/pricing/monthly";

type BillingNavigation = ReturnType<typeof useBillingNavigation>;

/** The icon of each benefit a Pro plan lists, so every line reads at a glance. */
const BENEFIT_ICONS = {
  "pro-feature-1": Tick01Icon,
  "pro-feature-2": SparklesIcon,
  "pro-feature-3": BookOpen01Icon,
  "pro-feature-5": CustomerSupportIcon,
} as const satisfies Record<
  (typeof proPlanFeatures)[number],
  typeof Tick01Icon
>;

/** One benefit of Pro: its icon and its line, in a two-column list. */
function Benefit({ icon, text }: { icon: typeof Tick01Icon; text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-6">
      <HugeIcons className="mt-1 size-4 shrink-0" icon={icon} />
      <span>{text}</span>
    </li>
  );
}

/**
 * The Plan card of a free viewer: the Pro offer in the viewer's currency, its
 * benefits, and the Upgrade action that starts checkout here, not on the pricing
 * page.
 */
export function UpgradePlanCard({ billing }: { billing: BillingNavigation }) {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const tPricing = useTranslations("Pricing");
  const credits = getPlanCreditConfig("pro").amount;

  const handleUpgrade = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    billing.openCheckout({
      locale,
      source: "settings-checkout",
    });
  };

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("plan")}</CardTitle>
        <CardDescription>
          {t("plan-free-description", {
            credits: getPlanCreditConfig("free").amount,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-1">
          <p className="font-medium text-xl tracking-tight">
            {tPricing("pro-title")}
          </p>
          <p className="text-muted-foreground">{tPricing("pro-description")}</p>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-2">
          {Arr.map(PricingCurrencySchema.literals, (currency) => (
            <CurrencyBranch currency={currency} key={currency}>
              <span className="font-semibold text-3xl tracking-tight">
                {getProPricingDisplay(currency).pro.text}
              </span>
            </CurrencyBranch>
          ))}
          <span className="text-muted-foreground">
            {tPricing("pro-period")}
          </span>
        </p>
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {Arr.map(proPlanFeatures, (key) => (
            <Benefit
              icon={BENEFIT_ICONS[key]}
              key={key}
              text={tPricing(key, { credits })}
            />
          ))}
        </ul>
      </CardContent>
      <CardSectionFooter hint={t("plan-free-footer")}>
        <CardSectionActions>
          <Button
            disabled={billing.isPending || !isActiveLocale(locale)}
            onClick={handleUpgrade}
          >
            <Spinner icon={Diamond02Icon} isLoading={billing.isPending} />
            {t("upgrade")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
