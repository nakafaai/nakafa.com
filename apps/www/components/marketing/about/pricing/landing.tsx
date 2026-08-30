import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { useTranslations } from "next-intl";
import { PricingDithering } from "@/components/marketing/about/pricing/dithering.client";
import {
  type PriceProps,
  PricingCards,
} from "@/components/marketing/about/pricing/plans";

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

/** Renders the landing pricing section and its established shader treatment. */
export function Pricing() {
  const t = useTranslations("Pricing");

  return (
    <section aria-labelledby="pricing-heading" className="border-b">
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="h-120 w-full overflow-hidden">
          <PricingDithering />
        </div>

        <div className="scroll-mt-28 px-6 pb-12 lg:px-10" id="pricing">
          <h2
            className="max-w-3xl text-balance text-3xl tracking-tight sm:text-4xl"
            id="pricing-heading"
          >
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>
        </div>

        <div className="border-t bg-card text-card-foreground">
          <PricingCards headingLevel="h3" Price={AnimatedPrice} />
        </div>
      </div>
    </section>
  );
}
