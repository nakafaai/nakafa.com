"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { PartyIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import refs from "@repo/backend/confect/_generated/refs";
import { products } from "@repo/backend/confect/utils/polar/products";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useConvexAuth } from "convex/react";

import { useLocale, useTranslations } from "next-intl";
import { Activity } from "react";
import { FormBlock } from "@/components/user/settings/block";
import { useBillingNavigation } from "@/lib/billing/navigation.client";
import { isActiveLocale } from "@/lib/i18n/active";

interface UserSettingsSubscriptionsProps {
  initialSubscription: Ref.Returns<
    typeof refs.public.subscriptions.queries.hasActiveSubscription
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

  const billing = useBillingNavigation();

  const { isAuthenticated } = useConvexAuth();
  const subscription = useQuery(
    refs.public.subscriptions.queries.hasActiveSubscription,
    isAuthenticated ? { productId: products.pro.id } : "skip"
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
    <FormBlock
      description={t("subscriptions-description")}
      title={t("subscriptions")}
    >
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
            {t("get-pro")}
          </Button>
        </Activity>
      </div>
    </FormBlock>
  );
}
