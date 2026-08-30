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
import type { ComponentProps, ComponentType } from "react";
import { Suspense, use } from "react";
import { PricingButton } from "@/components/marketing/about/pricing/button.client";
import {
  getProPricingDisplay,
  pricingCountryHeaderName,
} from "@/components/marketing/about/pricing/display";
import { PricingDithering } from "@/components/marketing/about/pricing/dithering.client";

interface PricingFeatureProps {
  icon?: ComponentProps<typeof HugeIcons>["icon"];
  text: string;
}

type PricingDisplay = ReturnType<typeof getProPricingDisplay>;
type Price = PricingDisplay["pro"];

interface PriceProps {
  price: Price;
}

interface PricingPlanCardsProps {
  headingLevel: "h2" | "h3";
  Price: ComponentType<PriceProps>;
  pricingDisplay: PricingDisplay;
}

/** Renders the animated price used on the marketing homepage. */
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

/** Renders a server-formatted price without adding animation to page prefetch. */
function StaticPrice({ price }: PriceProps) {
  return (
    <span className="font-semibold text-4xl tracking-tight">{price.text}</span>
  );
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
function PricingPlanCards({
  Price,
  headingLevel,
  pricingDisplay,
}: PricingPlanCardsProps) {
  const t = useTranslations("Pricing");
  const PlanHeading = headingLevel;
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
    t("pro-feature-5"),
  ];

  return (
    <div className="grid lg:grid-cols-2 lg:divide-x">
      <div className="flex flex-col gap-6 px-6 py-12 lg:px-10">
        <div className="grid gap-2">
          <PlanHeading className="text-balance font-semibold text-3xl">
            {t("free-title")}
          </PlanHeading>
          <p className="text-pretty text-muted-foreground">
            {t("free-description")}
          </p>
          <div className="pt-2">
            <Price price={pricingDisplay.free} />
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
                href="/auth"
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

      <div className="flex flex-col gap-6 px-6 py-12 lg:px-10">
        <div className="grid gap-2">
          <PlanHeading className="text-balance font-semibold text-3xl">
            {t("pro-title")}
          </PlanHeading>
          <p className="text-pretty text-muted-foreground">
            {t("pro-description")}
          </p>
          <div className="flex items-baseline gap-1 pt-2">
            <Price price={pricingDisplay.pro} />
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
          <PricingButton />
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
function RequestPricedCards({
  Price,
  headingLevel,
}: Pick<PricingPlanCardsProps, "Price" | "headingLevel">) {
  const requestHeaders = use(headers());
  const pricingDisplay = getProPricingDisplay(
    requestHeaders.get(pricingCountryHeaderName)
  );

  return (
    <PricingPlanCards
      headingLevel={headingLevel}
      Price={Price}
      pricingDisplay={pricingDisplay}
    />
  );
}

/** Streams request-priced cards without showing a false default price. */
function PricingCards({
  Price,
  headingLevel,
}: Pick<PricingPlanCardsProps, "Price" | "headingLevel">) {
  return (
    <Suspense fallback={null}>
      <RequestPricedCards headingLevel={headingLevel} Price={Price} />
    </Suspense>
  );
}

/** Renders the marketing pricing section with request-location price display. */
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

/** Renders the dedicated pricing-page introduction and shared plan cards. */
export function PricingPagePlans() {
  const t = useTranslations("PricingPage");

  return (
    <section aria-labelledby="pricing-heading" className="border-b">
      <div className="mx-auto w-full max-w-7xl">
        <div
          className="scroll-mt-28 px-6 py-24 sm:py-28 lg:px-10 lg:py-32"
          id="pricing"
        >
          <h1
            className="max-w-3xl text-balance text-3xl tracking-tight sm:text-4xl"
            id="pricing-heading"
          >
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>

      <div className="border-t bg-card text-card-foreground">
        <div className="mx-auto w-full max-w-7xl border-x">
          <PricingCards headingLevel="h2" Price={StaticPrice} />
        </div>
      </div>
    </section>
  );
}
