import {
  ArrowUpRight01Icon,
  Rocket01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import type { ComponentProps, ComponentType } from "react";
import { PricingButton } from "@/components/marketing/about/pricing/button.client";
import {
  type PriceProps,
  PricingPrice,
} from "@/components/marketing/about/pricing/price";

interface PricingFeatureProps {
  icon?: ComponentProps<typeof HugeIcons>["icon"];
  text: string;
}

interface PricingPlanCardsProps {
  headingLevel: "h2" | "h3";
  Price: ComponentType<PriceProps>;
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

/** Renders stable plan cards around request-localized price slots. */
export function PricingCards({ Price, headingLevel }: PricingPlanCardsProps) {
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
      <div
        className="flex flex-col gap-6 px-6 py-12 lg:px-10"
        data-pricing-plan="free"
      >
        <div className="grid gap-2">
          <PlanHeading className="text-balance font-semibold text-3xl">
            {t("free-title")}
          </PlanHeading>
          <p className="text-pretty text-muted-foreground">
            {t("free-description")}
          </p>
          <div className="pt-2">
            <PricingPrice Price={Price} plan="free" />
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

      <div
        className="flex flex-col gap-6 px-6 py-12 lg:px-10"
        data-pricing-plan="pro"
      >
        <div className="grid gap-2">
          <PlanHeading className="text-balance font-semibold text-3xl">
            {t("pro-title")}
          </PlanHeading>
          <p className="text-pretty text-muted-foreground">
            {t("pro-description")}
          </p>
          <div className="pt-2">
            <PricingPrice Price={Price} period={t("pro-period")} plan="pro" />
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
