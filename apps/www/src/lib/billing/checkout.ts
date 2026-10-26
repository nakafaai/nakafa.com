import type { Ref } from "@confect/core";
import { useAction } from "@confect/react";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { useConvex } from "convex/react";
import { Array as Arr, Effect, Schema } from "effect";
import { useState, useTransition } from "react";
import { reportClientException } from "@/lib/analytics/client";
import {
  type BillingDestination,
  billingNavigationProgram,
  checkoutReturnUrl,
} from "@/lib/billing/navigation";
import { requireConvexOnline } from "@/lib/convex/online";
import { readShownCurrency } from "@/lib/pricing/currency";

const BillingSourceSchema = Schema.Struct({
  source: Schema.String,
});

type BillingSource = typeof BillingSourceSchema.Type;

/** The copy a failed checkout shows, for the Pro plan and for a top-up pack alike. */
const CHECKOUT_FAILURE_COPY = {
  description: "checkout-error.description",
  title: "checkout-error.title",
} as const satisfies ToastCopy;

/** One Pro offer the payment method dialog lists, as the offers read answers it. */
export type ProOffer = Ref.Returns<typeof billing.queries.proOffers>[number];

/** The offers a learner chooses between while the payment method dialog is open, and where the request came from. */
type ProChoice = BillingSource & {
  readonly locale: ActiveAppLocaleCode;
  readonly offers: Arr.NonEmptyReadonlyArray<ProOffer>;
};

/** Owns checkout and customer-portal requests for every client purchase CTA. */
export function useBillingNavigation() {
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<ProChoice | null>(null);
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

  /** Starts the checkout of one Pro offer in the currency the page shows. */
  const checkoutOffer = (
    offer: ProOffer["offer"],
    {
      locale,
      ...failure
    }: BillingSource & { readonly locale: ActiveAppLocaleCode }
  ) =>
    runBillingRequest(
      Effect.tryPromise(() =>
        createCheckout({
          currency: readShownCurrency(document.documentElement),
          locale,
          offer,
          successUrl: checkoutReturnUrl(window.location.href),
        })
      ).pipe(
        Effect.flatMap(Effect.fromResult),
        // A user who already holds Pro is routed to the portal instead of a second checkout.
        Effect.catchTag("ProAlreadyHeld", portalRequest)
      ),
      { ...failure, copy: CHECKOUT_FAILURE_COPY }
    );

  return {
    isPending,
    /** The offers the payment method dialog lists while it is open. */
    choice,
    /** Closes the payment method dialog without buying. */
    dismissChoice: () => setChoice(null),
    /** Starts the checkout of the offer the learner chose in the payment method dialog. */
    chooseOffer: (offer: ProOffer["offer"]) => {
      if (choice === null) {
        return;
      }
      setChoice(null);
      checkoutOffer(offer, choice);
    },
    /**
     * Reads the Pro offers sold in the currency the page shows, then opens the
     * payment method dialog when there is a choice, or the one offer's checkout
     * at once. A pass holder extends Pro, so only passes are offered.
     */
    openCheckout: ({
      locale,
      passesOnly = false,
      ...failure
    }: BillingSource & {
      readonly locale: ActiveAppLocaleCode;
      readonly passesOnly?: boolean;
    }) =>
      startTransition(() =>
        Effect.runPromise(
          requireConvexOnline(convex).pipe(
            Effect.andThen(
              Effect.tryPromise(() => import("@/lib/billing/offers"))
            ),
            Effect.flatMap(({ readProOffers }) =>
              readProOffers(
                readShownCurrency(document.documentElement),
                passesOnly
              )
            ),
            Effect.tapError((cause) =>
              reportClientException(cause, { source: failure.source })
            ),
            Effect.match({
              onFailure: () => {
                toast.error(CHECKOUT_FAILURE_COPY, {
                  position: "bottom-center",
                });
              },
              onSuccess: Arr.match({
                // No rail sells Pro here now, which only a pass holder whose passes left Xendit meets.
                onEmpty: () => {
                  toast.error(CHECKOUT_FAILURE_COPY, {
                    position: "bottom-center",
                  });
                },
                onNonEmpty: (offers) => {
                  if (Arr.length(offers) > 1) {
                    setChoice({ ...failure, locale, offers });
                    return;
                  }
                  checkoutOffer(Arr.headNonEmpty(offers).offer, {
                    ...failure,
                    locale,
                  });
                },
              }),
            })
          )
        )
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
