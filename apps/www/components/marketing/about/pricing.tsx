import { useTranslations } from "next-intl";
import { PricingDithering } from "@/components/marketing/about/pricing.client";

export function Pricing() {
  const t = useTranslations("Pricing");

  return (
    <section
      className="scroll-mt-28 border-b bg-linear-to-b from-primary/20 to-background"
      id="pricing"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="h-120 w-full overflow-hidden">
          <PricingDithering />
        </div>

        <div className="px-6 pb-12">
          <h2 className="max-w-3xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>
        </div>
      </div>
    </section>
  );
}
