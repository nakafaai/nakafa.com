import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { headers } from "next/headers";
import type { ComponentType } from "react";
import { Suspense, use } from "react";
import {
  getProPricingDisplay,
  pricingCountryHeaderName,
} from "@/components/marketing/about/pricing/display";

type PricingDisplay = ReturnType<typeof getProPricingDisplay>;
type PricingPlan = keyof PricingDisplay;

export interface PriceProps {
  price: PricingDisplay[PricingPlan];
}

interface PricingPriceProps {
  Price: ComponentType<PriceProps>;
  period?: string;
  plan: PricingPlan;
}

/** Resolves only the request-localized amount inside its price slot. */
function ResolvedPrice({ period, Price, plan }: PricingPriceProps) {
  const requestHeaders = use(headers());
  const pricingDisplay = getProPricingDisplay(
    requestHeaders.get(pricingCountryHeaderName)
  );

  return (
    <span className="flex h-10 items-baseline gap-2 whitespace-nowrap">
      <Price price={pricingDisplay[plan]} />
      {period ? <span className="text-muted-foreground">{period}</span> : null}
    </span>
  );
}

function PriceFallback() {
  return (
    <span className="flex h-10 items-center">
      <Skeleton
        aria-hidden="true"
        className="h-10 w-28"
        data-pricing-price-fallback
      />
    </span>
  );
}

/** Keeps plan geometry stable while the request-localized amount streams. */
export function PricingPrice({ period, Price, plan }: PricingPriceProps) {
  return (
    <div
      className="flex h-10 w-fit min-w-28 items-baseline"
      data-pricing-price-slot={plan}
    >
      <Suspense fallback={<PriceFallback />}>
        <ResolvedPrice Price={Price} period={period} plan={plan} />
      </Suspense>
    </div>
  );
}
