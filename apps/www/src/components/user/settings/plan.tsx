import { Settings01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Match } from "effect";
import { useLocale, useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { UpgradePlanCard } from "@/components/user/settings/upgrade";
import { useBillingNavigation } from "@/lib/billing/checkout";
import {
  type BillingOverview,
  type BillingSubscription,
  formatBillingDate,
  type PlanState,
  planStateOf,
  providerNameOf,
  subscribedDescriptionKey,
} from "@/lib/billing/plan";
import { isActiveLocale } from "@/lib/i18n/active";

type SubscribedState = Extract<PlanState, { kind: "subscribed" }>;

/**
 * The plan card. A subscribed viewer sees the dates and the provider of the
 * subscription, a free viewer sees the upgrade, and Pro that no subscription
 * bills here is only named.
 */
export function UserSettingsPlan({ overview }: { overview: BillingOverview }) {
  return Match.value(planStateOf(overview)).pipe(
    Match.discriminatorsExhaustive("kind")({
      free: () => <UpgradePlanCard />,
      granted: () => <GrantedPlanCard />,
      subscribed: (state) => <SubscribedPlanCard state={state} />,
    })
  );
}

/** Pro that this account holds without a subscription of its own. */
function GrantedPlanCard() {
  const t = useTranslations("Auth");
  const tPricing = useTranslations("Pricing");

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{tPricing("pro-title")}</CardTitle>
        <CardDescription>{t("plan-granted-description")}</CardDescription>
      </CardHeader>
      <CardSectionFooter hint={t("plan-granted-footer")} />
    </CardSection>
  );
}

/** A subscription's dates and provider, with the billing portal that changes it. */
function SubscribedPlanCard({ state }: { state: SubscribedState }) {
  const billing = useBillingNavigation();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const tPricing = useTranslations("Pricing");
  const { ending, pastDue, subscription } = state;

  const handleManage = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    billing.openPortal({
      source: "settings-portal",
    });
  };

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{tPricing("pro-title")}</CardTitle>
        <CardDescription>
          {t(subscribedDescriptionKey({ ending, pastDue }))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">{t("period-start")}</dt>
          <dd>{formatBillingDate(subscription.currentPeriodStart, locale)}</dd>
          <EndDate ending={ending} subscription={subscription} />
          <dt className="text-muted-foreground">{t("paid-with")}</dt>
          <dd>{providerNameOf(subscription.rail)}</dd>
        </dl>
      </CardContent>
      <CardSectionFooter
        hint={t(pastDue ? "plan-pro-past-due-footer" : "plan-pro-footer")}
      >
        <CardSectionActions>
          <Button
            disabled={billing.isPending || !isActiveLocale(locale)}
            onClick={handleManage}
          >
            <Spinner icon={Settings01Icon} isLoading={billing.isPending} />
            {t("manage-billing")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}

/**
 * The row that says when the paid period ends: "Renews on" for a subscription
 * that continues, "Ends on" for one that stops there. A subscription without an
 * end date shows no row.
 */
function EndDate({
  ending,
  subscription,
}: {
  ending: boolean;
  subscription: BillingSubscription;
}) {
  const locale = useLocale();
  const t = useTranslations("Auth");

  if (subscription.currentPeriodEnd === null) {
    return null;
  }
  return (
    <>
      <dt className="text-muted-foreground">
        {t(ending ? "ends-on" : "renews-on")}
      </dt>
      <dd>{formatBillingDate(subscription.currentPeriodEnd, locale)}</dd>
    </>
  );
}
