import { PricingDithering } from "@/components/marketing/about/pricing.client";

export function Pricing() {
  return (
    <section
      className="scroll-mt-28 border-b bg-linear-to-b from-primary/20 to-background"
      id="pricing"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="h-120 w-full overflow-hidden">
          <PricingDithering />
        </div>
      </div>
    </section>
  );
}
