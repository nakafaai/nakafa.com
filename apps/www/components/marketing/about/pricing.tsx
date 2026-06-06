import {
  ArrowUpRight01Icon,
  Rocket01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { headers } from "next/headers";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Suspense, use } from "react";
import {
  PricingDithering,
  ProButton,
} from "@/components/marketing/about/pricing.client";
import {
  getProPricingDisplay,
  pricingCountryHeaderName,
} from "@/components/marketing/about/pricing-display";

interface PricingFeatureProps {
  icon?: ComponentProps<typeof HugeIcons>["icon"];
  text: string;
}

type PricingDisplay = ReturnType<typeof getProPricingDisplay>;

interface PricingPlanCardsProps {
  pricingDisplay: PricingDisplay;
}

/** Renders one pricing card feature row with a stable icon slot. */
function PricingFeature({ text, icon }: PricingFeatureProps) {
  return (
    <div className="flex items-start gap-3">
      <HugeIcons className="mt-0.5 size-4" icon={icon || Tick01Icon} />
      <span className="text-sm leading-relaxed">{text}</span>
    </div>
  );
}

/** Renders the pricing plan cards with an already resolved price display. */
function PricingPlanCards({ pricingDisplay }: PricingPlanCardsProps) {
  const t = useTranslations("Pricing");
  const freeFeatures = [
    t("free-feature-1"),
    t("free-feature-2"),
    t("free-feature-3"),
    t("free-feature-4"),
    t("free-feature-5"),
  ];

  const proFeatures = [
    t("pro-feature-1"),
    t("pro-feature-2"),
    t("pro-feature-3"),
    t("pro-feature-4"),
    t("pro-feature-5"),
  ];

  return (
    <div className="grid lg:grid-cols-2 lg:divide-x">
      <div className="flex flex-col gap-6 px-6 py-12">
        <div className="grid gap-2">
          <h3 className="font-semibold text-3xl">{t("free-title")}</h3>
          <p className="text-muted-foreground">{t("free-description")}</p>
          <div className="pt-2">
            <NumberFormat
              className="font-semibold text-4xl tracking-tight"
              format={pricingDisplay.free.format}
              locales={pricingDisplay.free.locales}
              value={pricingDisplay.free.value}
            />
          </div>
        </div>

        <div className="grid gap-3">
          {freeFeatures.map((feature) => (
            <PricingFeature key={feature} text={feature} />
          ))}
        </div>

        <div className="mt-auto pt-4">
          <Button
            className="w-full"
            nativeButton={false}
            render={
              <NavigationLink
                href="/home"
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeIcons icon={ArrowUpRight01Icon} />
                {t("free-cta")}
              </NavigationLink>
            }
            variant="outline"
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 px-6 py-12">
        <div className="grid gap-2">
          <h3 className="font-semibold text-3xl">{t("pro-title")}</h3>
          <p className="text-muted-foreground">{t("pro-description")}</p>
          <div className="flex items-baseline gap-1 pt-2">
            <NumberFormat
              className="font-semibold text-4xl tracking-tight"
              format={pricingDisplay.pro.format}
              locales={pricingDisplay.pro.locales}
              value={pricingDisplay.pro.value}
            />
            <span className="ml-1 text-muted-foreground">
              {t("pro-period")}
            </span>
          </div>
        </div>

        <div className="grid gap-3">
          <PricingFeature icon={Rocket01Icon} text={proFeatures[0]} />
          <div className="grid gap-3 border-t pt-3">
            {proFeatures.slice(1).map((feature) => (
              <PricingFeature key={feature} text={feature} />
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4">
          <ProButton />
        </div>
      </div>
    </div>
  );
}

/**
 * Renders request-priced cards inside Suspense so Cache Components can keep the
 * surrounding pricing shell prerenderable.
 *
 * Docs: https://nextjs.org/docs/app/getting-started/caching#dynamic-rendering
 */
function RequestPricedCards() {
  const requestHeaders = use(headers());
  const pricingDisplay = getProPricingDisplay(
    requestHeaders.get(pricingCountryHeaderName)
  );

  return <PricingPlanCards pricingDisplay={pricingDisplay} />;
}

/** Renders stable default pricing while request-location pricing streams in. */
function PricingCardsFallback() {
  return <PricingPlanCards pricingDisplay={getProPricingDisplay(null)} />;
}

/** Renders the marketing pricing section with request-location price display. */
export function Pricing() {
  const t = useTranslations("Pricing");

  return (
    <section className="border-b">
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="h-120 w-full overflow-hidden">
          <PricingDithering />
        </div>

        <div className="scroll-mt-28 px-6 pb-12" id="pricing">
          <h2 className="max-w-3xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>
        </div>

        <div className="border-t bg-card text-card-foreground">
          <Suspense fallback={<PricingCardsFallback />}>
            <RequestPricedCards />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
