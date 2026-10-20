import { QueryResult, useQuery } from "@confect/react";
import { Diamond02Icon } from "@hugeicons/core-free-icons";
import subscriptions from "@repo/backend/confect/_generated/refs/subscriptions";
import { proProductIdFor } from "@repo/backend/confect/customers/polar/catalog";
import { polarPublicKeys } from "@repo/backend/public";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { Effect } from "effect";
import { useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import type { PricingButtonVariant } from "@/components/marketing/about/pricing/button";
import { reportClientException } from "@/lib/analytics/client";
import {
  getPostAuthOnboardingHref,
  getPostAuthProviderErrorHref,
} from "@/lib/auth/admission";
import { requestGoogleSignIn } from "@/lib/auth/google";
import { startGoogleSignIn } from "@/lib/auth/social";
import { useBillingNavigation } from "@/lib/billing/checkout";
import { isActiveLocale } from "@/lib/i18n/active";
import { useViewer } from "@/lib/identity/client";

/**
 * The signed-in billing action. It mounts its own island around the page's one
 * Convex client, so every query and action it runs shares that client.
 */
export function BillingButton({
  client,
  variant,
}: {
  client: ConvexReactClient;
  variant: PricingButtonVariant;
}) {
  return (
    <ConvexProvider client={client}>
      <BillingAction variant={variant} />
    </ConvexProvider>
  );
}

/** Opens browser-originated checkout or the existing customer's portal. */
function BillingAction({ variant }: { variant: PricingButtonVariant }) {
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const callbackURL = getPostAuthOnboardingHref("/pricing", locale);
  const errorCallbackURL = getPostAuthProviderErrorHref("/pricing", locale);
  const currentUser = useViewer((state) => state.account);
  const isIdentityPending = useViewer((state) => state.isPending);
  const billing = useBillingNavigation();
  const [isAuthPending, startAuthTransition] = useTransition();

  const subscription = useQuery(
    subscriptions.queries.hasActiveSubscription,
    currentUser
      ? { productId: proProductIdFor(polarPublicKeys().VITE_POLAR_SERVER) }
      : "skip"
  );
  if (QueryResult.isFailure(subscription)) {
    throw subscription.error;
  }
  const subscriptionResolved = QueryResult.isSuccess(subscription);
  const hasSubscription = subscriptionResolved && subscription.value;
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
          toast.error({
            description: "provider-error.description",
            title: "provider-error.title",
          });
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
  const isWaiting = isIdentityPending || !billingReady;

  return (
    <Button
      className="w-full"
      disabled={isPending || isWaiting || !isActiveLocale(locale)}
      onClick={handleBilling}
      variant={variant}
    >
      <Spinner icon={Diamond02Icon} isLoading={isPending || isWaiting} />
      {t("pro-cta")}
    </Button>
  );
}
