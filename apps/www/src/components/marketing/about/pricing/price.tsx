import { Array as Arr } from "effect";
import type { ComponentType } from "react";
import { useTranslations } from "use-intl";
import { CurrencyBranch } from "@/components/marketing/about/pricing/currency";
import { getProPricingDisplay } from "@/components/marketing/about/pricing/display";
import { PricingCurrencySchema } from "@/lib/pricing/monthly";

type PricingDisplay = ReturnType<typeof getProPricingDisplay>;
type PricingPlan = keyof PricingDisplay;

export interface PriceProps {
  price: PricingDisplay[PricingPlan];
}

interface PricingPriceProps {
  Price: ComponentType<PriceProps>;
  period?: string | undefined;
  plan: PricingPlan;
}

/** Renders a price of one currency without the landing animation. */
export function StaticPrice({ price }: PriceProps) {
  return (
    <span className="font-semibold text-4xl tracking-tight">{price.text}</span>
  );
}

/**
 * Keeps plan geometry stable: the slot has its final height before its amount is
 * known. The slot holds the price of every currency, and the visitor's currency
 * is the one that lays out.
 */
export function PricingPrice({ period, Price, plan }: PricingPriceProps) {
  return (
    <div
      className="flex h-10 w-fit min-w-28 items-baseline"
      data-pricing-price-slot={plan}
    >
      <div className="flex h-10 items-baseline gap-2 whitespace-nowrap">
        {Arr.map(PricingCurrencySchema.literals, (currency) => (
          <CurrencyBranch currency={currency} key={currency}>
            <Price price={getProPricingDisplay(currency)[plan]} />
          </CurrencyBranch>
        ))}
        {period ? (
          <span className="text-muted-foreground">{period}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The yearly Pro price under the monthly one, in every currency's branch. A
 * Pro checkout offers both, so the learner picks the interval at checkout.
 */
export function PricingYearly() {
  const t = useTranslations("Pricing");

  return (
    <div className="text-muted-foreground text-sm" data-pricing-yearly="">
      {Arr.map(PricingCurrencySchema.literals, (currency) => (
        <CurrencyBranch currency={currency} key={currency}>
          {t("pro-yearly", {
            price: getProPricingDisplay(currency).proYearly.text,
          })}
        </CurrencyBranch>
      ))}
    </div>
  );
}
