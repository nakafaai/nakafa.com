"use client";

import { PartyIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useAction } from "convex/react";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { Activity, useTransition } from "react";
import { FormBlock } from "@/components/shared/form-block";
import { isActiveLocale } from "@/lib/i18n/active";

export function UserSettingsSubscriptions() {
  const locale = useLocale();
  const t = useTranslations("Auth");

  const [isPending, startTransition] = useTransition();

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    { productId: products.pro.id }
  );
  const generateCustomerPortalUrl = useAction(
    api.customers.actions.public.generateCustomerPortalUrl
  );
  const generateCheckoutLink = useAction(
    api.customers.actions.public.generateCheckoutLink
  );

  const handleCheckout = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    const program = Effect.tryPromise(() =>
      generateCheckoutLink({ locale, successUrl: window.location.href })
    ).pipe(
      Effect.tap(({ url }) =>
        Effect.sync(() => {
          window.location.href = url;
        })
      ),
      Effect.asVoid
    );
    startTransition(() => Effect.runPromise(program));
  };

  const handleManageSubscription = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    const program = Effect.tryPromise(() => generateCustomerPortalUrl({})).pipe(
      Effect.tap(({ url }) =>
        Effect.sync(() => {
          window.location.href = url;
        })
      ),
      Effect.asVoid
    );
    startTransition(() => Effect.runPromise(program));
  };

  return (
    <FormBlock
      description={t("subscriptions-description")}
      title={t("subscriptions")}
    >
      <div className="flex items-center gap-4">
        <Activity mode={hasSubscription ? "visible" : "hidden"}>
          <Button
            disabled={isPending || !isActiveLocale(locale)}
            onClick={handleManageSubscription}
          >
            <Spinner icon={Settings01Icon} isLoading={isPending} />
            {t("manage")}
          </Button>
        </Activity>
        <Activity mode={hasSubscription ? "hidden" : "visible"}>
          <Button
            disabled={isPending || !isActiveLocale(locale)}
            onClick={handleCheckout}
          >
            <Spinner icon={PartyIcon} isLoading={isPending} />
            {t("get-pro")}
          </Button>
        </Activity>
      </div>
    </FormBlock>
  );
}
