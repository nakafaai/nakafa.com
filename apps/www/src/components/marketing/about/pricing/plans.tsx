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
import { Nina } from "@repo/design-system/components/ui/nina";
import { Array as Arr } from "effect";
import type { ComponentType, ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  type PriceProps,
  PricingPrice,
  PricingYearly,
} from "@/components/marketing/about/pricing/price";
import { freePlanFeatures, proPlanFeatures } from "@/lib/marketing/plan";
import { Link } from "@/lib/routing/link";

interface PricingPlanCardsProps {
  headingLevel: "h2" | "h3";
  Price: ComponentType<PriceProps>;
  /** The Pro card's action, which the page gives the emphasis it needs. */
  proAction: ReactNode;
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
 * The Free card's action: a visitor signs in on a new page, so the plans stay
 * open, and a learner opens home. Both are rendered, and the signed-in hint of the
 * root picks the one that shows, as the header's call to action does.
 */
function FreePlanAction() {
  const t = useTranslations("Pricing");

  return (
    <>
      <span className="contents" data-account="visitor">
        <Button
          className="w-full"
          nativeButton={false}
          render={
            <Link rel="noopener noreferrer" target="_blank" to="/$locale/auth">
              <HugeIcons icon={ArrowUpRight01Icon} />
              {t("free-cta")}
            </Link>
          }
          variant="outline"
        />
      </span>
      <span className="contents" data-account="member">
        <Button
          className="w-full"
          nativeButton={false}
          render={<Link to="/$locale/home">{t("free-cta")}</Link>}
          variant="outline"
        />
      </span>
    </>
  );
}

/**
 * The two plan cards. Pro stands out with the brand ring, and Nina peeks from
 * behind its top edge: the card is drawn over her, so its line cuts her body.
 * From `md` the cards share four rows (heading, price, list, action), so the
 * lists start on one line and the two actions sit on one line at the bottom,
 * whichever plan holds more lines. The prices come from the slots of each plan.
 */
export function PricingCards({
  Price,
  headingLevel,
  proAction,
}: PricingPlanCardsProps) {
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
          <FreePlanAction />
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
          <CardContent className="grid content-start gap-1">
            <PricingPrice Price={Price} period={t("pro-period")} plan="pro" />
            <PricingYearly />
          </CardContent>
          <CardContent>
            <ul className="grid gap-3">
              {Arr.map(proPlanFeatures, (key) => (
                <PricingFeature key={key} text={t(key, { credits })} />
              ))}
            </ul>
          </CardContent>
          <CardFooter>{proAction}</CardFooter>
        </Card>
      </div>
    </div>
  );
}
