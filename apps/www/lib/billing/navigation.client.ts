"use client";

import { useAction } from "@confect/react";
import customers from "@repo/backend/confect/_generated/refs/customers";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { useConvex } from "convex/react";
import { Effect, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";
import { billingNavigationProgram } from "@/lib/billing/navigation";
import { requireConvexOnline } from "@/lib/convex/online";

const BillingSourceSchema = Schema.Struct({
  source: Schema.String,
});

type BillingSource = typeof BillingSourceSchema.Type;

/** Owns checkout and customer-portal requests for every client purchase CTA. */
export function useBillingNavigation() {
  const t = useTranslations("Auth");
  const [isPending, startTransition] = useTransition();
  const convex = useConvex();
  const createCheckout = useAction(
    customers.actions.sessions.generateCheckoutLink
  );
  const createPortal = useAction(
    customers.actions.sessions.generateCustomerPortalUrl
  );

  function runBillingRequest<E>(
    request: Effect.Effect<{ readonly url: string }, E>,
    failure: BillingSource & { readonly message: string }
  ) {
    startTransition(() =>
      Effect.runPromise(
        billingNavigationProgram({
          navigate: (url) => {
            window.location.href = url;
          },
          onFailure: () =>
            Effect.sync(() => {
              toast.error(failure.message, { position: "bottom-center" });
            }),
          request: requireConvexOnline(convex).pipe(
            Effect.andThen(
              request.pipe(
                Effect.tapError((cause) =>
                  reportClientException(cause, { source: failure.source })
                )
              )
            )
          ),
        })
      )
    );
  }

  return {
    isPending,
    openCheckout: ({
      locale,
      ...failure
    }: BillingSource & { readonly locale: PublicAppLocale }) =>
      runBillingRequest(
        Effect.tryPromise(() =>
          createCheckout({ locale, successUrl: window.location.href })
        ).pipe(Effect.flatMap(Effect.fromResult)),
        { ...failure, message: t("checkout-error") }
      ),
    openPortal: (source: BillingSource) =>
      runBillingRequest(
        Effect.tryPromise(() => createPortal({})).pipe(
          Effect.flatMap(Effect.fromResult)
        ),
        {
          ...source,
          message: t("portal-error"),
        }
      ),
  };
}
