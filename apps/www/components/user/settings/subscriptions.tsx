"use client";

import { PartyIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { Activity, useTransition } from "react";
import { FormBlock } from "@/components/shared/form-block";

export function UserSettingsSubscriptions() {
  const t = useTranslations("Auth");

  const [isPending, startTransition] = useTransition();

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    { productId: products.pro.id }
  );
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );
  const generateCustomerPortalUrl = useAction(
    api.customers.actions.generateCustomerPortalUrl
  );

  const handleCheckout = () => {
    startTransition(async () => {
      const { url } = await generateCheckoutLink({
        productIds: [products.pro.id],
        successUrl: window.location.href,
      });
      window.open(url, "_blank");
    });
  };

  const handleManageSubscription = () => {
    startTransition(async () => {
      const { url } = await generateCustomerPortalUrl({});
      window.open(url, "_blank");
    });
  };

  return (
    <FormBlock
      description={t("subscriptions-description")}
      title={t("subscriptions")}
    >
      <div className="flex items-center gap-4">
        <Activity mode={hasSubscription ? "visible" : "hidden"}>
          <Button disabled={isPending} onClick={handleManageSubscription}>
            <Spinner icon={Settings01Icon} isLoading={isPending} />
            {t("manage")}
          </Button>
        </Activity>
        <Activity mode={hasSubscription ? "hidden" : "visible"}>
          <Button disabled={isPending} onClick={handleCheckout}>
            <Spinner icon={PartyIcon} isLoading={isPending} />
            {t("get-pro")}
          </Button>
        </Activity>
      </div>
    </FormBlock>
  );
}
