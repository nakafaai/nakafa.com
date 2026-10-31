import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  createLearnerCheckout,
  validateCheckoutRequest,
} from "@repo/backend/confect/billing/checkout";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { offerUnavailable } from "@repo/backend/confect/billing/pro";
import {
  checkoutCountryFor,
  routeOffer,
} from "@repo/backend/confect/billing/route";
import spec from "@repo/backend/confect/billing/sessions.spec";
import {
  TopupRequiresPro,
  topupRequiresProCode,
} from "@repo/backend/confect/billing/spec";
import { createXenditCheckout } from "@repo/backend/confect/billing/xendit/checkout";
import { Effect } from "effect";

/**
 * Starts the checkout of one top-up pack. Only a learner on Pro buys one. The
 * rail follows the currency the page showed, so a learner who pays in rupiah
 * buys it through Xendit without a card, as they buy a pass.
 */
export const generateTopupCheckoutLink = FunctionImpl.make(
  databaseSchema,
  spec,
  "generateTopupCheckoutLink",
  Effect.fn("billing.sessions.generateTopupCheckoutLink")(function* (args) {
    const { appUser } = yield* requireAuth();
    const request = yield* validateCheckoutRequest(args);
    if (appUser.plan !== "pro") {
      return yield* new TopupRequiresPro({
        code: topupRequiresProCode,
        message: "Top-up credits are for learners on Pro.",
      });
    }
    const route = yield* routeOffer(
      checkoutCountryFor(args.currency),
      "pro.topup"
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
        offer: "pro.topup",
        successUrl: request.successUrl,
      });
    }
    return yield* createLearnerCheckout({
      appUserId: appUser._id,
      productIds: [polarProductIdFor("pro.topup", request.server)],
      request,
      requiresPro: true,
    });
  })
);
