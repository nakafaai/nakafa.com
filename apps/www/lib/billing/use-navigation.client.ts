"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { useAction } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";
import { billingNavigationProgram } from "@/lib/billing/navigation";

interface BillingSource {
  readonly source: string;
}

interface CheckoutNavigation extends BillingSource {
  readonly locale: PublicAppLocale;
}

/** Owns checkout and customer-portal requests for every client purchase CTA. */
export function useBillingNavigation() {
  const t = useTranslations("Auth");
  const [isPending, startTransition] = useTransition();
  const createCheckout = useAction(
    api.customers.actions.public.generateCheckoutLink
  );
  const createPortal = useAction(
    api.customers.actions.public.generateCustomerPortalUrl
  );

  function runBillingRequest(
    request: () => Promise<{ url: string }>,
    failure: BillingSource & { readonly message: string }
  ) {
    startTransition(() =>
      Effect.runPromise(
        billingNavigationProgram({
          navigate: (url) => {
            window.location.href = url;
          },
          onFailure: (cause) =>
            reportClientException(cause, { source: failure.source }).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  toast.error(failure.message, { position: "bottom-center" });
                })
              )
            ),
          request,
        })
      )
    );
  }

  return {
    isPending,
    openCheckout: ({ locale, ...failure }: CheckoutNavigation) =>
      runBillingRequest(
        () => createCheckout({ locale, successUrl: window.location.href }),
        { ...failure, message: t("checkout-error") }
      ),
    openPortal: (source: BillingSource) =>
      runBillingRequest(() => createPortal({}), {
        ...source,
        message: t("portal-error"),
      }),
  };
}
