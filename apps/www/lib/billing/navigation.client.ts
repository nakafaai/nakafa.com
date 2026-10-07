"use client";

import { useAction } from "@confect/react";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";
import { billingNavigationProgram } from "@/lib/billing/navigation";

const BillingSourceSchema = Schema.Struct({
  source: Schema.String,
});

const CheckoutNavigationSchema = Schema.Struct({
  ...BillingSourceSchema.fields,
  locale: ActiveAppLocaleCodeSchema,
});

type BillingSource = typeof BillingSourceSchema.Type;
type CheckoutNavigation = typeof CheckoutNavigationSchema.Type;

/** Owns checkout and customer-portal requests for every client purchase CTA. */
export function useBillingNavigation() {
  const t = useTranslations("Auth");
  const [isPending, startTransition] = useTransition();
  const createCheckout = useAction(
    refs.public.customers.actions.sessions.generateCheckoutLink
  );
  const createPortal = useAction(
    refs.public.customers.actions.sessions.generateCustomerPortalUrl
  );

  function runBillingRequest<E>(
    request: Effect.Effect<{ readonly url: string }, E>,
    failure: BillingSource & { readonly message: string }
  ) {
    startTransition(() =>
      Effect.runPromise(
        billingNavigationProgram(
          request,
          (url) => {
            window.location.href = url;
          },
          (cause) =>
            reportClientException(cause, { source: failure.source }).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  toast.error(failure.message, { position: "bottom-center" });
                })
              )
            )
        )
      )
    );
  }

  return {
    isPending,
    openCheckout: ({ locale, ...failure }: CheckoutNavigation) =>
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
