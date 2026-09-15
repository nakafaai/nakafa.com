"use client";

import { PartyIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Activity } from "react";
import { FormBlock } from "@/components/shared/form-block";
import { useBillingNavigation } from "@/lib/billing/use-navigation.client";
import { isActiveLocale } from "@/lib/i18n/active";

interface UserSettingsSubscriptionsProps {
  preloadedSubscription: Preloaded<
    typeof api.subscriptions.queries.hasActiveSubscription
  >;
}

/**
 * Renders the subscription card from the value the settings route already
 * resolved, so the plan action never swaps between two labels.
 */
export function UserSettingsSubscriptions({
  preloadedSubscription,
}: UserSettingsSubscriptionsProps) {
  const locale = useLocale();
  const t = useTranslations("Auth");

  const billing = useBillingNavigation();

  const hasSubscription = usePreloadedQuery(preloadedSubscription);
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
