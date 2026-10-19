import type { ComponentType } from "react";
import { use } from "react";
import { PricingCountryContext } from "@/components/marketing/about/pricing/country";
import { getProPricingDisplay } from "@/components/marketing/about/pricing/display";

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

/** Resolves only the request-localized amount inside its price slot. */
function ResolvedPrice({ period, Price, plan }: PricingPriceProps) {
  const pricingDisplay = getProPricingDisplay(use(PricingCountryContext));

  return (
    <span className="flex h-10 items-baseline gap-2 whitespace-nowrap">
      <Price price={pricingDisplay[plan]} />
      {period ? <span className="text-muted-foreground">{period}</span> : null}
    </span>
  );
}

/** Renders a request-localized price without the landing animation. */
export function StaticPrice({ price }: PriceProps) {
  return (
    <span className="font-semibold text-4xl tracking-tight">{price.text}</span>
  );
}

/** Keeps plan geometry stable: the slot has its final height before its amount is known. */
export function PricingPrice({ period, Price, plan }: PricingPriceProps) {
  return (
    <div
      className="flex h-10 w-fit min-w-28 items-baseline"
      data-pricing-price-slot={plan}
    >
      <ResolvedPrice Price={Price} period={period} plan={plan} />
    </div>
  );
}
