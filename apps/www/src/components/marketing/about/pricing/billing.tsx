import { QueryResult, useQuery } from "@confect/react";
import { Diamond02Icon } from "@hugeicons/core-free-icons";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { localizeInternalHref } from "@repo/internationalization/src/href";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { Effect } from "effect";
import { useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ProOfferDialog } from "@/components/billing/offers";
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

/**
 * Opens the checkout, or where the learner's plan is managed: Polar's portal for
 * a Polar plan, the billing settings for a plan Xendit bills. A pass holder is
 * offered only passes, which extend the pass.
 */
function BillingAction({ variant }: { variant: PricingButtonVariant }) {
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const callbackURL = getPostAuthOnboardingHref("/pricing", locale);
  const errorCallbackURL = getPostAuthProviderErrorHref("/pricing", locale);
  const currentUser = useViewer((state) => state.account);
  const isIdentityPending = useViewer((state) => state.isPending);
  const billing = useBillingNavigation();
  const [isAuthPending, startAuthTransition] = useTransition();

  const overview = useQuery(
    billingRefs.queries.overview,
    currentUser ? {} : "skip"
  );
  if (QueryResult.isFailure(overview)) {
    throw overview.error;
  }
  const overviewResolved = QueryResult.isSuccess(overview);
  const subscription = overviewResolved ? overview.value.subscription : null;
  const holdsPass = overviewResolved && overview.value.pass !== null;
  const billingReady = !currentUser || overviewResolved;

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

    // Polar's portal manages a Polar plan; a plan Xendit bills is managed in the settings.
    if (subscription?.rail === "polar") {
      billing.openPortal({
        source: "pricing-portal",
      });
      return;
    }
    if (subscription?.rail === "xendit") {
      window.location.assign(
        localizeInternalHref("/user/settings/subscriptions", locale)
      );
      return;
    }

    billing.openCheckout({
      locale,
      passesOnly: holdsPass,
      source: "pricing-checkout",
    });
  };
  // A signed-in learner without a plan reads the offers as soon as they point at the button.
  const warmBilling = () => {
    if (currentUser && subscription === null && overviewResolved) {
      billing.warmCheckout({ passesOnly: holdsPass });
    }
  };
  const isPending = billing.isPending || isAuthPending;
  const isWaiting = isIdentityPending || !billingReady;

  return (
    <>
      <Button
        className="w-full"
        disabled={isPending || isWaiting || !isActiveLocale(locale)}
        onClick={handleBilling}
        onFocus={warmBilling}
        onPointerEnter={warmBilling}
        variant={variant}
      >
        <Spinner icon={Diamond02Icon} isLoading={isPending || isWaiting} />
        {t("pro-cta")}
      </Button>
      <ProOfferDialog
        choose={billing.chooseOffer}
        dismiss={billing.dismissChoice}
        isPending={billing.isPending}
        offers={billing.choice?.offers ?? null}
      />
    </>
  );
}
