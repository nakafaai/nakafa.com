import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  createAdmittedCheckoutSession,
  type ValidCheckoutRequest,
  validateCheckoutRequest,
} from "@repo/backend/confect/billing/checkout";
import { ensureProviderCustomer } from "@repo/backend/confect/billing/customer";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import spec from "@repo/backend/confect/billing/sessions.spec";
import {
  checkoutSessionIoError,
  ProAlreadyHeld,
  proAlreadyHeldCode,
  TopupRequiresPro,
  topupRequiresProCode,
} from "@repo/backend/confect/billing/spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Effect, flow, Layer } from "effect";

/**
 * The Pro offers one checkout sells. Polar lets the learner switch between
 * them in its checkout and selects the first, so monthly is the default and
 * yearly, at the price of 10 months, is one tap away.
 */
const PRO_CHECKOUT_OFFERS = ["pro.monthly", "pro.yearly"] as const;

/**
 * Starts one hosted Polar checkout for a learner's personal account. The
 * checkout is admitted again once Polar has answered, so a deletion that starts
 * meanwhile withholds it. `requiresPro` also withholds it when Pro ended meanwhile.
 */
const createLearnerCheckout = Effect.fn(
  "billing.sessions.createLearnerCheckout"
)(function* (input: {
  readonly appUserId: Docs["users"]["_id"];
  readonly productIds: readonly string[];
  readonly request: ValidCheckoutRequest;
  readonly requiresPro: boolean;
}) {
  const ctx = yield* ActionCtxService;
  const { runMutation } = yield* MutationRunner;
  const { request } = input;
  const requestMetadata = yield* Effect.tryPromise({
    try: () => ctx.meta.getRequestMetadata(),
    catch: checkoutSessionIoError,
  });
  const customerId = yield* ensureProviderCustomer(input.appUserId);
  const checkout = yield* createAdmittedCheckoutSession({
    createCheckout: polarGateway.createCheckoutSession({
      customerId,
      customerIpAddress: requestMetadata.ip,
      locale: request.polarLocale,
      productIds: input.productIds,
      successUrl: request.successUrl,
    }),
    admitCheckout: Clock.currentTimeMillis.pipe(
      Effect.flatMap((timestamp) =>
        runMutation(refs.internal.billing.checkout.admitCheckout, {
          event: {
            name: "checkout started",
            properties: {
              checkout_locale: request.polarLocale,
              customer_ip_available: requestMetadata.ip !== null,
              locale: request.locale,
              product_count: input.productIds.length,
              product_id: Arr.join(input.productIds, ","),
            },
          },
          requiresPro: input.requiresPro,
          timestamp,
          userId: input.appUserId,
        })
      ),
      Effect.mapError(checkoutSessionIoError),
      Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
    ),
  });
  return { url: checkout.url };
});

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

/** Starts the checkout of one top-up pack. Only a learner on Pro buys one. */
const generateTopupCheckoutLink = FunctionImpl.make(
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
