import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { useTranslations } from "next-intl";
import { PricingCards } from "@/components/marketing/about/pricing/plans";
import type { PriceProps } from "@/components/marketing/about/pricing/price";

/** Animates prices only on the landing surface that owns this treatment. */
function AnimatedPrice({ price }: PriceProps) {
  return (
    <NumberFormat
      className="font-semibold text-4xl tracking-tight"
      format={price.format}
      locales={price.locales}
      value={price.value}
    />
  );
}

/**
 * The home pricing part: the heading, then the shared plan comparison with the
 * price of each visitor's region.
 */
export function Pricing() {
  const t = useTranslations("Landing");

  return (
    <section aria-labelledby="pricing-heading" className="scroll-mt-28">
      <div
        className="mx-auto w-full max-w-7xl px-6 pt-20 lg:px-10 lg:pt-32"
        id="pricing"
      >
        <h2
          className="max-w-3xl text-balance text-3xl tracking-tight sm:text-4xl"
          id="pricing-heading"
        >
          {t("prices-title")}
        </h2>
      </div>

      <div className="mx-auto mt-12 w-full max-w-7xl border-y bg-card text-card-foreground">
        <PricingCards headingLevel="h3" Price={AnimatedPrice} />
      </div>
    </section>
  );
}
