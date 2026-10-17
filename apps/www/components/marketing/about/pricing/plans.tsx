import { ArrowUpRight01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { PricingButton } from "@/components/marketing/about/pricing/button.client";
import {
  type PriceProps,
  PricingPrice,
} from "@/components/marketing/about/pricing/price";
import { freePlanFeatures, proPlanFeatures } from "@/lib/marketing/plan";

interface PricingPlanCardsProps {
  headingLevel: "h2" | "h3";
  Price: ComponentType<PriceProps>;
}

/** One line of a plan: a tick and its text. */
function PricingFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 text-base leading-6">
      <HugeIcons className="mt-1 size-4 shrink-0" icon={Tick01Icon} />
      <span>{text}</span>
    </li>
  );
}

/**
 * The two plan cards. Pro stands out with the brand ring, and Nina peeks from
 * behind its top edge: the card is drawn over her, so its line cuts her body.
 * From `md` the cards share four rows (heading, price, list, action), so the
 * lists start on one line and the two actions sit on one line at the bottom,
 * whichever plan holds more lines. The prices come from the slots of each plan.
 */
export function PricingCards({ Price, headingLevel }: PricingPlanCardsProps) {
  const t = useTranslations("Pricing");
  const PlanHeading = headingLevel;
  const credits = getPlanCreditConfig("pro").amount;

  return (
    <div className="mx-auto mt-20 grid w-full max-w-4xl gap-x-4 gap-y-18 md:grid-cols-2 md:grid-rows-[auto_auto_1fr_auto] md:gap-y-6">
      <Card
        className="md:row-span-4 md:grid md:grid-rows-subgrid"
        data-pricing-plan="free"
      >
        <CardHeader>
          <PlanHeading className="font-medium text-xl tracking-tight">
            {t("free-title")}
          </PlanHeading>
          <p className="text-muted-foreground">{t("free-description")}</p>
        </CardHeader>
        <CardContent className="grid content-start gap-1">
          <PricingPrice Price={Price} plan="free" />
          <p className="text-muted-foreground text-sm">
            {t("free-worth-card")} {t("free-worth-trial")}
          </p>
        </CardContent>
        <CardContent>
          <ul className="grid gap-3">
            {Arr.map(freePlanFeatures, (key) => (
              <PricingFeature key={key} text={t(key)} />
            ))}
          </ul>
        </CardContent>
        <CardFooter>
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
        </CardFooter>
      </Card>

      <div className="relative grid md:row-span-4 md:grid-rows-subgrid">
        <span className="absolute right-6 bottom-[calc(100%-0.5rem)]">
          <Nina
            fidget={["greeting"]}
            label=""
            lean="peek"
            mood="winking"
            size={72}
          />
        </span>
        <Card
          className="relative ring-2 ring-primary md:row-span-4 md:grid md:grid-rows-subgrid"
          data-pricing-plan="pro"
        >
          <CardHeader>
            <PlanHeading className="font-medium text-xl tracking-tight">
              {t("pro-title")}
            </PlanHeading>
            <p className="text-muted-foreground">{t("pro-description")}</p>
          </CardHeader>
          <CardContent className="grid content-start">
            <PricingPrice Price={Price} period={t("pro-period")} plan="pro" />
          </CardContent>
          <CardContent>
            <ul className="grid gap-3">
              {Arr.map(proPlanFeatures, (key) => (
                <PricingFeature key={key} text={t(key, { credits })} />
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <PricingButton />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
