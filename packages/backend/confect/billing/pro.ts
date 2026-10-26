import { FunctionImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  createLearnerCheckout,
  validateCheckoutRequest,
} from "@repo/backend/confect/billing/checkout";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import {
  checkoutCountryFor,
  routeOffer,
} from "@repo/backend/confect/billing/route";
import spec from "@repo/backend/confect/billing/sessions.spec";
import {
  CheckoutOfferUnavailable,
  checkoutOfferUnavailableCode,
  checkoutSessionIoError,
  ProAlreadyHeld,
  proAlreadyHeldCode,
} from "@repo/backend/confect/billing/spec";
import { createXenditCheckout } from "@repo/backend/confect/billing/xendit/checkout";
import { Array as Arr, Effect, flow } from "effect";

/**
 * The Pro offers one Polar checkout sells. Polar lets the learner switch between
 * them in its checkout and selects the first, so monthly is the default and
 * yearly, at the price of 10 months, is one tap away.
 */
const PRO_CHECKOUT_OFFERS = ["pro.monthly", "pro.yearly"] as const;

/** An offer the buyer's rail does not sell now. The learner sees the checkout failure, and the reason is logged. */
function offerUnavailable(cause: { readonly message: string }) {
  return Effect.logWarning("Pro offer is not sold to this buyer", {
    message: cause.message,
  }).pipe(
    Effect.andThen(
      Effect.fail(
        new CheckoutOfferUnavailable({
          code: checkoutOfferUnavailableCode,
          message: "This offer is not available here.",
        })
      )
    )
  );
}

/**
 * Starts the Pro checkout of one offer. A learner who already holds Pro is sent
 * to the plan's management instead. The rail follows the currency the page showed:
 * a Xendit hosted session in Indonesia once the switch names Xendit, and the Polar
 * checkout of monthly and yearly Pro everywhere else.
 */
export const generateCheckoutLink = FunctionImpl.make(
  databaseSchema,
  spec,
  "generateCheckoutLink",
  Effect.fn("billing.sessions.generateCheckoutLink")(function* (args) {
    const { appUser } = yield* requireAuth();
    const { runQuery } = yield* QueryRunner;
    const request = yield* validateCheckoutRequest(args);
    const holdsPro = yield* runQuery(refs.internal.billing.checkout.holdsPro, {
      userId: appUser._id,
    }).pipe(
      Effect.mapError(checkoutSessionIoError),
      Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
    );
    if (holdsPro) {
      return yield* new ProAlreadyHeld({
        code: proAlreadyHeldCode,
        message:
          "This account already holds Pro. Manage the plan in the customer portal.",
      });
    }
    const route = yield* routeOffer(
      checkoutCountryFor(args.currency),
      args.offer
    ).pipe(
      Effect.catchTags({
        ConfigError: offerUnavailable,
        OfferUnavailable: offerUnavailable,
        XenditNotConfigured: offerUnavailable,
      })
    );
    if (route.rail === "xendit") {
      return yield* createXenditCheckout({
        amount: route.amount,
        appUserId: appUser._id,
        locale: request.locale,
        offer: args.offer,
        successUrl: request.successUrl,
      });
    }
    return yield* createLearnerCheckout({
      appUserId: appUser._id,
      productIds: Arr.map(PRO_CHECKOUT_OFFERS, (offer) =>
        polarProductIdFor(offer, request.server)
      ),
      request,
      requiresPro: false,
    });
  })
);
