"use client";
import { QueryResult, useAction, useQuery } from "@confect/react";
import { PartyIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import refs from "@repo/backend/confect/_generated/refs";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";

import { useTranslations } from "next-intl";
import { Activity, useTransition } from "react";
import { FormBlock } from "@/components/shared/form-block";
import { products } from "@/lib/polar/products";

export function UserSettingsSubscriptions() {
  const t = useTranslations("Auth");

  const [isPending, startTransition] = useTransition();

  const subscriptionResult = useQuery(
    refs.public.subscriptions.queries.hasActiveSubscription,
    { productId: products.pro.id }
  );
  const hasSubscription =
    QueryResult.isSuccess(subscriptionResult) && subscriptionResult.value;
  const generateCheckoutLink = useAction(
    refs.public.customers.actions.publicFunctions.generateCheckoutLink
  );
  const generateCustomerPortalUrl = useAction(
    refs.public.customers.actions.publicFunctions.generateCustomerPortalUrl
  );

  const handleCheckout = () => {
    startTransition(async () => {
      const { url } = await generateCheckoutLink({
        productIds: [products.pro.id],
        successUrl: window.location.href,
      });
      window.location.href = url;
    });
  };

  const handleManageSubscription = () => {
    startTransition(async () => {
      const { url } = await generateCustomerPortalUrl({});
      window.location.href = url;
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
