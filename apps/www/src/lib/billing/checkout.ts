import type { Ref } from "@confect/core";
import { useAction } from "@confect/react";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { useConvex } from "convex/react";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { useRef, useState, useTransition } from "react";
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

/**
 * Starts one read of the Pro offers sold in `currency` from a browser event,
 * loading the read on intent so no page carries it before then, and hands back
 * its outcome.
 */
function startOffersRead(
  convex: Parameters<typeof requireConvexOnline>[0],
  currency: ReturnType<typeof readShownCurrency>,
  passesOnly: boolean
) {
  return Effect.runPromiseExit(
    requireConvexOnline(convex).pipe(
      Effect.andThen(Effect.tryPromise(() => import("@/lib/billing/offers"))),
      Effect.flatMap(({ readProOffers }) => readProOffers(currency, passesOnly))
    )
  );
}

/** Owns checkout and customer-portal requests for every client purchase CTA. */
export function useBillingNavigation() {
  const [isPending, startTransition] = useTransition();
  // The offers the payment method dialog lists while it is open, and where the request came from.
  // The offers read a Pro button started on the learner's intent, which its click then uses.
  const warmed = useRef(
    Option.none<{
      readonly exit: ReturnType<typeof startOffersRead>;
      readonly key: string;
    }>()
  );
  const [choice, setChoice] = useState<
    | (BillingSource & {
        readonly locale: ActiveAppLocaleCode;
        readonly offers: Arr.NonEmptyReadonlyArray<ProOffer>;
      })
    | null
  >(null);
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

  /** Starts the offers read of the currency the page shows, once per kind of request, and hands back that read. */
  const offersRead = (passesOnly: boolean) => {
    const currency = readShownCurrency(document.documentElement);
    const key = `${currency}:${passesOnly}`;
    const started = Option.filter(warmed.current, (read) => read.key === key);
    if (Option.isSome(started)) {
      return started.value.exit;
    }
    const exit = startOffersRead(convex, currency, passesOnly);
    warmed.current = Option.some({ exit, key });
    return exit;
  };

  return {
    isPending,
    /** The offers the payment method dialog lists while it is open. */
    choice,
    /**
     * Starts reading the offers as soon as the learner points at or focuses a Pro
     * button, so the click finds them read and opens the dialog at once.
     */
    warmCheckout: ({
      passesOnly = false,
    }: {
      readonly passesOnly?: boolean;
    }) => {
      offersRead(passesOnly);
    },
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
          Effect.promise(() => offersRead(passesOnly)).pipe(
            Effect.flatten,
            // A failed read is not kept, so the next click reads the offers again.
            Effect.tapError(() =>
              Effect.sync(() => {
                warmed.current = Option.none();
              })
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
