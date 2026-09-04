"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";
import {
  getPostAuthContinuationHref,
  getPostAuthProviderErrorHref,
} from "@/lib/auth/admission";
import { startGoogleSignIn } from "@/lib/auth/social";
import { requestGoogleSignIn } from "@/lib/auth/social.client";
import { useBillingNavigation } from "@/lib/billing/use-navigation.client";
import { useUser } from "@/lib/context/use-user";
import { isActiveLocale } from "@/lib/i18n/active";

/** Opens browser-originated checkout or the existing customer's portal. */
export function BillingButton() {
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const tAuth = useTranslations("Auth");
  const callbackURL = getPostAuthContinuationHref("/pricing", locale);
  const errorCallbackURL = getPostAuthProviderErrorHref("/pricing", locale);
  const currentUser = useUser((state) => state.user);
  const billing = useBillingNavigation();
  const [isAuthPending, startAuthTransition] = useTransition();

  const { data: hasSubscription, isSuccess: subscriptionResolved } =
    useQueryWithStatus(
      api.subscriptions.queries.hasActiveSubscription,
      currentUser ? { productId: products.pro.id } : "skip"
    );
  const billingReady = !currentUser || subscriptionResolved;

  const handleBilling = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    if (!currentUser) {
      startAuthTransition(async () => {
        const started = await Effect.runPromise(
          startGoogleSignIn(
            { callbackURL, errorCallbackURL },
            requestGoogleSignIn
          ).pipe(
            Effect.tapError((error) =>
              reportClientException(error, {
                source: "pricing-google-sign-in",
              })
            ),
            Effect.match({
              onFailure: () => false,
              onSuccess: () => true,
            })
          )
        );
        if (!started) {
          toast.error(tAuth("provider-error"));
        }
      });
      return;
    }

    if (hasSubscription) {
      billing.openPortal({
        source: "pricing-portal",
      });
      return;
    }

    billing.openCheckout({
      locale,
      source: "pricing-checkout",
    });
  };
  const isPending = billing.isPending || isAuthPending;

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
