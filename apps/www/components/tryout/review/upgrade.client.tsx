"use client";

import { useMutation } from "@confect/react";
import { Diamond02Icon } from "@hugeicons/core-free-icons";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Data, Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { reportClientException } from "@/lib/analytics/client";
import { useBillingNavigation } from "@/lib/billing/navigation.client";
import { isActiveLocale } from "@/lib/i18n/active";
import { useViewer } from "@/lib/identity/client";

/** A failed optional paywall impression never changes access to free scores. */
class TryoutReviewImpressionError extends Data.TaggedError(
  "TryoutReviewImpressionError"
)<{ readonly cause: unknown }> {}

/**
 * Starts Pro checkout from a locked review. Checkout returns to this page, and
 * the review reloads as soon as the account's plan becomes Pro.
 */
export function TryoutReviewCheckout() {
  const t = useTranslations("Pricing");
  const locale = useLocale();
  const router = useRouter();
  const billing = useBillingNavigation();
  const [isRefreshing, startRefresh] = useTransition();
  const plan = useViewer((state) => state.viewer?.plan);
  const trackPaywall = useMutation(tryouts.mutations.access.trackPaywallView);

  useEffect(() => {
    Effect.runPromise(
      Effect.tryPromise({
        try: () => trackPaywall({ source: "review" }),
        catch: (cause) => new TryoutReviewImpressionError({ cause }),
      }).pipe(
        Effect.flatMap((result) =>
          Effect.fromResult(result).pipe(
            Effect.mapError(
              (cause) => new TryoutReviewImpressionError({ cause })
            )
          )
        ),
        Effect.catchTag("TryoutReviewImpressionError", (error) =>
          reportClientException(error, { source: "tryout-paywall-view" })
        )
      )
    );
  }, [trackPaywall]);

  useEffect(() => {
    if (plan === "pro") {
      startRefresh(() => router.refresh());
    }
  }, [plan, router]);

  const pending = billing.isPending || isRefreshing;

  return (
    <Button
      disabled={pending || !isActiveLocale(locale)}
      onClick={() => {
        if (!isActiveLocale(locale)) {
          return;
        }
        billing.openCheckout({ locale, source: "tryout-review-checkout" });
      }}
    >
      <Spinner
        data-icon="inline-start"
        icon={Diamond02Icon}
        isLoading={pending}
      />
      {t("pro-cta")}
    </Button>
  );
}
