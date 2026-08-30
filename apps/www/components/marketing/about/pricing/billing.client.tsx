"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useAction } from "convex/react";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { authClient } from "@/lib/auth/client";
import { useUser } from "@/lib/context/use-user";
import { isActiveLocale } from "@/lib/i18n/active";

/** Opens browser-originated checkout or the existing customer's portal. */
export function BillingButton() {
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const callbackURL = `/${locale}/pricing`;
  const [isPending, startTransition] = useTransition();
  const currentUser = useUser((state) => state.user);

  const { data: hasSubscription, isSuccess: subscriptionResolved } =
    useQueryWithStatus(
      api.subscriptions.queries.hasActiveSubscription,
      currentUser ? { productId: products.pro.id } : "skip"
    );
  const createPortal = useAction(
    api.customers.actions.public.generateCustomerPortalUrl
  );
  const createCheckout = useAction(
    api.customers.actions.public.generateCheckoutLink
  );
  const billingReady = !currentUser || subscriptionResolved;

  const handleBilling = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    const program = currentUser
      ? Effect.tryPromise(() =>
          hasSubscription
            ? createPortal({})
            : createCheckout({ locale, successUrl: window.location.href })
        ).pipe(
          Effect.tap(({ url }) =>
            Effect.sync(() => {
              window.location.href = url;
            })
          ),
          Effect.asVoid
        )
      : Effect.tryPromise(() =>
          authClient.signIn.social({
            callbackURL,
            provider: "google",
          })
        ).pipe(Effect.asVoid);

    startTransition(() => Effect.runPromise(program));
  };

  return (
    <Button
      className="w-full"
      disabled={isPending || !billingReady || !isActiveLocale(locale)}
      onClick={handleBilling}
    >
      <Spinner icon={Diamond02Icon} isLoading={isPending || !billingReady} />
      {t("pro-cta")}
    </Button>
  );
}
