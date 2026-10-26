import { useTranslations } from "use-intl";
import { PricingButton } from "@/components/marketing/about/pricing/button";
import { PricingCards } from "@/components/marketing/about/pricing/plans";
import {
  PricingPrice,
  StaticPrice,
} from "@/components/marketing/about/pricing/price";

/**
 * The home pricing part: the heading, then the shared plan comparison with the
 * price of each visitor's region. Each currency's price is its own text that
 * never changes on the page, so nothing animates it.
 */
export function Pricing() {
  const t = useTranslations("Landing");
  const tPricing = useTranslations("Pricing");

  return (
    <section aria-labelledby="pricing-heading" className="scroll-mt-28">
      <div
        className="mx-auto w-full max-w-7xl px-6 pt-20 lg:px-10 lg:pt-32"
        id="pricing"
      >
        <h2
          className="mx-auto max-w-3xl text-balance text-center text-3xl tracking-tight sm:text-4xl"
          id="pricing-heading"
        >
          {t("prices-title")}
        </h2>
      </div>

      <div className="px-6 lg:px-10">
        <PricingCards
          freePrice={<PricingPrice Price={StaticPrice} plan="free" />}
          headingLevel="h3"
          proAction={<PricingButton variant="secondary" />}
          proPrice={
            <PricingPrice
              Price={StaticPrice}
              period={tPricing("pro-period")}
              plan="pro"
            />
          }
        />
      </div>
    </section>
  );
}
