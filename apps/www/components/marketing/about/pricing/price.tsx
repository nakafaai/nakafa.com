import { Array as Arr } from "effect";
import type { ComponentType } from "react";
import {
  getProPricingDisplay,
  type ProMonthlyPricing,
  proMonthlyPricings,
} from "@/components/marketing/about/pricing/display";

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

interface CurrencyPriceProps extends PricingPriceProps {
  pricing: ProMonthlyPricing;
}

/** One plan's price in one currency, marked with that currency for the page's script. */
function CurrencyPrice({ period, Price, plan, pricing }: CurrencyPriceProps) {
  return (
    <span
      className="flex h-10 items-baseline gap-2 whitespace-nowrap"
      data-price-currency={pricing.price.currency}
    >
      <Price price={getProPricingDisplay(pricing)[plan]} />
      {period ? <span className="text-muted-foreground">{period}</span> : null}
    </span>
  );
}

/** Renders a price without the landing animation. */
export function StaticPrice({ price }: PriceProps) {
  return (
    <span className="font-semibold text-4xl tracking-tight">{price.text}</span>
  );
}

/**
 * Renders the plan's price in every currency, and the page shows the visitor's
 * one from the first paint. The slot takes the width of the shown price, so
 * nothing moves once the page is painted.
 */
export function PricingPrice({ period, Price, plan }: PricingPriceProps) {
  return (
    <div
      className="flex h-10 w-fit min-w-28 items-baseline"
      data-pricing-price-slot={plan}
    >
      {Arr.map(proMonthlyPricings, (pricing) => (
        <CurrencyPrice
          key={pricing.price.currency}
          Price={Price}
          period={period}
          plan={plan}
          pricing={pricing}
        />
      ))}
    </div>
  );
}
