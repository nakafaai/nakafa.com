"use client";

import { PartyIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useLocale, useTranslations } from "next-intl";
import { Activity } from "react";
import { FormBlock } from "@/components/shared/form-block";
import { useBillingNavigation } from "@/lib/billing/use-navigation.client";
import { isActiveLocale } from "@/lib/i18n/active";

export function UserSettingsSubscriptions() {
  const locale = useLocale();
  const t = useTranslations("Auth");

  const billing = useBillingNavigation();

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    { productId: products.pro.id }
  );
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
