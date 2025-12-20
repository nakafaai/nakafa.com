"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar";
import { Button } from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { useAction, useQuery } from "convex/react";
import { PartyPopperIcon, Settings2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Activity, useTransition } from "react";
import { FormBlock } from "@/components/shared/form-block";

export function UserSettingsSubscriptions() {
  const t = useTranslations("Auth");

  const [isPending, startTransition] = useTransition();

  const hasSubscription = useQuery(
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
          <Button
            disabled={isPending}
            onClick={handleManageSubscription}
            variant="outline"
          >
            {isPending ? <SpinnerIcon /> : <Settings2Icon />}
            {t("manage")}
          </Button>
        </Activity>
        <Activity mode={hasSubscription ? "hidden" : "visible"}>
          <Button
            disabled={isPending}
            onClick={handleCheckout}
            variant="default"
          >
            {isPending ? <SpinnerIcon /> : <PartyPopperIcon />}
            {t("get-pro")}
          </Button>
        </Activity>
      </div>
    </FormBlock>
  );
}
