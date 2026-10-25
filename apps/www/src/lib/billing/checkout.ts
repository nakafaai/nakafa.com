import { useAction } from "@confect/react";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { useConvex } from "convex/react";
import { Effect, Schema } from "effect";
import { useTransition } from "react";
import { reportClientException } from "@/lib/analytics/client";
import {
  type BillingDestination,
  billingNavigationProgram,
  checkoutReturnUrl,
} from "@/lib/billing/navigation";
import { requireConvexOnline } from "@/lib/convex/online";

const BillingSourceSchema = Schema.Struct({
  source: Schema.String,
});

type BillingSource = typeof BillingSourceSchema.Type;

/** The copy a failed checkout shows, for the Pro plan and for a top-up pack alike. */
const CHECKOUT_FAILURE_COPY = {
  description: "checkout-error.description",
  title: "checkout-error.title",
} as const satisfies ToastCopy;

/** Owns checkout and customer-portal requests for every client purchase CTA. */
export function useBillingNavigation() {
  const [isPending, startTransition] = useTransition();
  const convex = useConvex();
  const createCheckout = useAction(billing.sessions.generateCheckoutLink);
  const createTopupCheckout = useAction(
    billing.sessions.generateTopupCheckoutLink
  );
  const createPortal = useAction(billing.sessions.generateCustomerPortalUrl);

  function runBillingRequest<E>(
    request: Effect.Effect<BillingDestination, E>,
    failure: BillingSource & { readonly copy: ToastCopy }
  ) {
    startTransition(() =>
      Effect.runPromise(
        billingNavigationProgram({
          navigate: (url) => {
            window.location.href = url;
          },
          onFailure: () =>
            Effect.sync(() => {
              toast.error(failure.copy, { position: "bottom-center" });
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

  /** The customer portal, where a user who already holds Pro manages the plan. */
  const portalRequest = () =>
    Effect.tryPromise(() => createPortal({})).pipe(
      Effect.flatMap(Effect.fromResult)
    );

  return {
    isPending,
    openCheckout: ({
      locale,
      ...failure
    }: BillingSource & { readonly locale: ActiveAppLocaleCode }) =>
      runBillingRequest(
        Effect.tryPromise(() =>
          createCheckout({
            locale,
            successUrl: checkoutReturnUrl(window.location.href),
          })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          // A user who already holds Pro is routed to the portal instead of a second checkout.
          Effect.catchTag("ProAlreadyHeld", portalRequest)
        ),
        { ...failure, copy: CHECKOUT_FAILURE_COPY }
      ),
    openTopupCheckout: ({
      locale,
      ...failure
    }: BillingSource & { readonly locale: ActiveAppLocaleCode }) =>
      runBillingRequest(
        Effect.tryPromise(() =>
          createTopupCheckout({
            locale,
            successUrl: checkoutReturnUrl(window.location.href),
          })
        ).pipe(Effect.flatMap(Effect.fromResult)),
        { ...failure, copy: CHECKOUT_FAILURE_COPY }
      ),
    openPortal: (source: BillingSource) =>
      runBillingRequest(portalRequest(), {
        ...source,
        copy: {
          description: "portal-error.description",
          title: "portal-error.title",
        },
      }),
  };
}
