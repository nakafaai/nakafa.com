import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { PartyIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import subscriptions from "@repo/backend/confect/_generated/refs/subscriptions";
import { proProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import { polarPublicKeys } from "@repo/backend/public";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Activity } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { CardSection } from "@/components/shared/card/section";
import { useBillingNavigation } from "@/lib/billing/checkout";
import { isActiveLocale } from "@/lib/i18n/active";

interface UserSettingsSubscriptionsProps {
  initialSubscription: Ref.Returns<
    typeof subscriptions.queries.hasActiveSubscription
  >;
}

/**
 * Renders the subscription card from the value the settings route already
 * resolved, so the plan action never swaps between two labels.
 */
export function UserSettingsSubscriptions({
  initialSubscription,
}: UserSettingsSubscriptionsProps) {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const tPricing = useTranslations("Pricing");

  const billing = useBillingNavigation();

  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const subscription = useQuery(
    subscriptions.queries.hasActiveSubscription,
    isAuthenticated
      ? { productId: proProductIdFor(polarPublicKeys().VITE_POLAR_SERVER) }
      : "skip"
  );
  if (QueryResult.isFailure(subscription)) {
    throw subscription.error;
  }
  const hasSubscription = QueryResult.isSuccess(subscription)
    ? subscription.value
    : initialSubscription;
  const handleCheckout = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    billing.openCheckout({
      locale,
      source: "settings-checkout",
    });
  };

  const handleManageSubscription = () => {
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
        <CardTitle>{t("subscriptions")}</CardTitle>
        <CardDescription>
          {t("subscriptions-description", {
            credits: getPlanCreditConfig("pro").amount,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Activity mode={hasSubscription ? "visible" : "hidden"}>
            <Button
              disabled={billing.isPending || !isActiveLocale(locale)}
              onClick={handleManageSubscription}
            >
              <Spinner icon={Settings01Icon} isLoading={billing.isPending} />
              {t("manage")}
            </Button>
          </Activity>
          <Activity mode={hasSubscription ? "hidden" : "visible"}>
            <Button
              disabled={billing.isPending || !isActiveLocale(locale)}
              onClick={handleCheckout}
            >
              <Spinner icon={PartyIcon} isLoading={billing.isPending} />
              {tPricing("pro-cta")}
            </Button>
          </Activity>
        </div>
      </CardContent>
    </CardSection>
  );
}
