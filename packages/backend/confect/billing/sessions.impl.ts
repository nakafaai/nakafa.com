import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  createLearnerCheckout,
  validateCheckoutRequest,
} from "@repo/backend/confect/billing/checkout";
import { ensureProviderCustomer } from "@repo/backend/confect/billing/customer";
import { generateTopupCheckoutLink } from "@repo/backend/confect/billing/pack";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import spec from "@repo/backend/confect/billing/sessions.spec";
import {
  checkoutSessionIoError,
  ProAlreadyHeld,
  proAlreadyHeldCode,
} from "@repo/backend/confect/billing/spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, flow, Layer } from "effect";

/**
 * The Pro offers one checkout sells. Polar lets the learner switch between
 * them in its checkout and selects the first, so monthly is the default and
 * yearly, at the price of 10 months, is one tap away.
 */
const PRO_CHECKOUT_OFFERS = ["pro.monthly", "pro.yearly"] as const;

const generateCheckoutLink = FunctionImpl.make(
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

const generateCustomerPortalUrl = FunctionImpl.make(
  databaseSchema,
  spec,
  "generateCustomerPortalUrl",
  Effect.fn("billing.sessions.generateCustomerPortalUrl")(function* () {
    const { appUser } = yield* requireAuth();
    const customerId = yield* ensureProviderCustomer(appUser._id);
    return yield* polarGateway.createCustomerPortalSession(customerId);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(generateCheckoutLink),
  Layer.provide(generateTopupCheckoutLink),
  Layer.provide(generateCustomerPortalUrl),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
