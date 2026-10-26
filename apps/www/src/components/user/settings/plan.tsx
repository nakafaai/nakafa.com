import { useMutation } from "@confect/react";
import {
  Cancel01Icon,
  Diamond02Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { billingOffer } from "@repo/backend/confect/billing/catalog";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Match } from "effect";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ProOfferDialog } from "@/components/billing/offers";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { UpgradePlanCard } from "@/components/user/settings/upgrade";
import { reportClientException } from "@/lib/analytics/client";
import { useBillingNavigation } from "@/lib/billing/checkout";
import {
  type BillingOverview,
  type BillingSubscription,
  cancelPlanChange,
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
      pass: ({ endsAt }) => <PassPlanCard endsAt={endsAt} />,
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

/**
 * Pro that passes give: the day the last of them ends, and the action that buys
 * another pass, which starts where this one ends. No portal manages a pass, since
 * nothing renews it.
 */
function PassPlanCard({ endsAt }: { endsAt: number }) {
  const billing = useBillingNavigation();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const tPricing = useTranslations("Pricing");

  const handleExtend = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    billing.openCheckout({
      locale,
      passesOnly: true,
      source: "settings-pass",
    });
  };

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{tPricing("pro-title")}</CardTitle>
        <CardDescription>
          {t("plan-pass-description", {
            date: formatBillingDate(endsAt, locale),
          })}
        </CardDescription>
      </CardHeader>
      <CardSectionFooter hint={t("plan-pass-footer")}>
        <CardSectionActions>
          <Button
            disabled={billing.isPending || !isActiveLocale(locale)}
            onClick={handleExtend}
          >
            <Spinner icon={Diamond02Icon} isLoading={billing.isPending} />
            {t("plan-pass-extend")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
      <ProOfferDialog
        choose={billing.chooseOffer}
        dismiss={billing.dismissChoice}
        isPending={billing.isPending}
        offers={billing.choice?.offers ?? null}
      />
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
          <dt className="text-muted-foreground">{t("billing-interval")}</dt>
          <dd>
            <BillingInterval offer={subscription.offer} />
          </dd>
          <dt className="text-muted-foreground">{t("paid-with")}</dt>
          <dd>{providerNameOf(subscription.rail)}</dd>
        </dl>
      </CardContent>
      {subscription.rail === "xendit" ? (
        <XenditPlanFooter ending={ending} subscription={subscription} />
      ) : (
        <CardSectionFooter
          hint={t(pastDue ? "plan-pro-past-due-footer" : "plan-pro-footer")}
        >
          <CardSectionActions>
            <Button
              disabled={billing.isPending || !isActiveLocale(locale)}
              onClick={handleManage}
              variant="outline"
            >
              <Spinner icon={Settings01Icon} isLoading={billing.isPending} />
              {t("manage-billing")}
            </Button>
          </CardSectionActions>
        </CardSectionFooter>
      )}
    </CardSection>
  );
}

/**
 * The footer of a plan Xendit bills, which no provider portal manages: the
 * learner cancels it here, after confirming, and it ends with its paid period.
 * A plan that already ends says so and offers nothing.
 */
function XenditPlanFooter({
  ending,
  subscription,
}: {
  ending: boolean;
  subscription: BillingSubscription;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [isConfirming, setIsConfirming] = useState(false);
  const cancelPlan = useMutation(
    billing.xendit.cancel.cancelPlan
  ).withOptimisticUpdate(cancelPlanChange);

  if (ending) {
    return <CardSectionFooter hint={t("plan-xendit-ending-footer")} />;
  }

  return (
    <CardSectionFooter hint={t("plan-xendit-footer")}>
      <CardSectionActions>
        <Button
          onClick={() => setIsConfirming(true)}
          type="button"
          variant="outline"
        >
          <HugeIcons icon={Cancel01Icon} />
          {t("plan-cancel")}
        </Button>
      </CardSectionActions>
      <ResponsiveDialog
        description={t("plan-cancel-description", {
          date: formatBillingDate(
            subscription.currentPeriodEnd ?? subscription.currentPeriodStart,
            locale
          ),
        })}
        footer={
          <>
            <Button
              onClick={() => setIsConfirming(false)}
              type="button"
              variant="outline"
            >
              {t("plan-keep")}
            </Button>
            <Button
              onClick={() => {
                setIsConfirming(false);
                Effect.runPromise(
                  Effect.tryPromise(() => cancelPlan({})).pipe(
                    Effect.flatMap(Effect.fromResult),
                    Effect.catch((error) =>
                      reportClientException(error, {
                        source: "components/user/settings/plan",
                      }).pipe(
                        Effect.andThen(
                          Effect.sync(() => {
                            toast.error({
                              description: "action-error.description",
                              title: "action-error.title",
                            });
                          })
                        )
                      )
                    )
                  )
                );
              }}
              type="button"
              variant="destructive"
            >
              <HugeIcons icon={Cancel01Icon} />
              {t("plan-cancel")}
            </Button>
          </>
        }
        open={isConfirming}
        setOpen={setIsConfirming}
        title={t("plan-cancel-title")}
      />
    </CardSectionFooter>
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

/** How the subscription bills: monthly, yearly, or a pass of some months, read from its offer in the catalog. */
function BillingInterval({ offer }: { offer: BillingSubscription["offer"] }) {
  const t = useTranslations("Auth");
  const { interval, months } = billingOffer(offer);

  return Match.value(interval).pipe(
    Match.when("month", () => t("billing-month")),
    Match.when("year", () => t("billing-year")),
    Match.when("pass", () => t("billing-pass", { months })),
    Match.exhaustive
  );
}
