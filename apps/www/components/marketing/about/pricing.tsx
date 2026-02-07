import {
  ArrowUpRight01Icon,
  Diamond02Icon,
  Mail01Icon,
  Rocket01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { PricingDithering } from "@/components/marketing/about/pricing.client";

const PRO_PRICE = 8.99;

interface PricingFeatureProps {
  text: string;
  icon?: ComponentProps<typeof HugeIcons>["icon"];
}

function PricingFeature({ text, icon }: PricingFeatureProps) {
  return (
    <div className="flex items-start gap-3">
      <HugeIcons className="mt-0.5 size-4" icon={icon || Tick01Icon} />
      <span className="text-sm leading-relaxed">{text}</span>
    </div>
  );
}

export function Pricing() {
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
    t("pro-feature-6"),
  ];

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
          <div className="grid lg:grid-cols-2 lg:divide-x">
            <div className="flex flex-col gap-6 px-6 py-12">
              <div className="grid gap-2">
                <h3 className="font-semibold text-3xl">{t("free-title")}</h3>
                <p className="text-muted-foreground">{t("free-description")}</p>
                <div className="pt-2">
                  <NumberFormat
                    className="font-semibold text-4xl tracking-tight"
                    format={{
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }}
                    prefix="$"
                    value={0}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                {freeFeatures.map((feature) => (
                  <PricingFeature key={feature} text={feature} />
                ))}
              </div>

              <div className="mt-auto pt-4">
                <Button className="w-full" variant="outline">
                  <HugeIcons icon={ArrowUpRight01Icon} />
                  {t("free-cta")}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-6 px-6 py-12">
              <div className="grid gap-2">
                <h3 className="font-semibold text-3xl">{t("pro-title")}</h3>
                <p className="text-muted-foreground">{t("pro-description")}</p>
                <div className="flex items-baseline gap-1 pt-2">
                  <NumberFormat
                    className="font-semibold text-4xl tracking-tight"
                    format={{
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }}
                    prefix="$"
                    value={PRO_PRICE}
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
                <Button className="w-full">
                  <HugeIcons icon={Diamond02Icon} />
                  {t("pro-cta")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-12">
          <div className="space-y-6">
            <div className="grid gap-2">
              <h3 className="font-semibold text-xl lg:text-2xl">
                {t("enterprise-title")}
              </h3>
              <p className="max-w-xl text-muted-foreground">
                {t("enterprise-description")}
              </p>
            </div>
            <Button
              nativeButton={false}
              render={
                <a
                  href="mailto:nakafaai@gmail.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HugeIcons icon={Mail01Icon} />
                  {t("enterprise-cta")}
                </a>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
