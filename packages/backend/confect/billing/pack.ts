import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  createLearnerCheckout,
  validateCheckoutRequest,
} from "@repo/backend/confect/billing/checkout";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import spec from "@repo/backend/confect/billing/sessions.spec";
import {
  TopupRequiresPro,
  topupRequiresProCode,
} from "@repo/backend/confect/billing/spec";
import { Effect } from "effect";

/** Starts the checkout of one top-up pack. Only a learner on Pro buys one. */
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
    return yield* createLearnerCheckout({
      appUserId: appUser._id,
      productIds: [polarProductIdFor("pro.topup", request.server)],
      request,
      requiresPro: true,
    });
  })
);
