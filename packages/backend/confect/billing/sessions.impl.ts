import { FunctionImpl, GroupImpl } from "@confect/server";
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
  validateCheckoutRequest,
} from "@repo/backend/confect/billing/checkout";
import { ensureProviderCustomer } from "@repo/backend/confect/billing/customer";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import spec from "@repo/backend/confect/billing/sessions.spec";
import {
  checkoutSessionIoError,
  ProAlreadyHeld,
  proAlreadyHeldCode,
} from "@repo/backend/confect/billing/spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Effect, flow, Layer } from "effect";

const generateCheckoutLink = FunctionImpl.make(
  databaseSchema,
  spec,
  "generateCheckoutLink",
  Effect.fn("billing.sessions.generateCheckoutLink")(function* (args) {
    const ctx = yield* ActionCtxService;
    const { appUser } = yield* requireAuth();
    const { runMutation } = yield* MutationRunner;
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
    const requestMetadata = yield* Effect.tryPromise({
      try: () => ctx.meta.getRequestMetadata(),
      catch: checkoutSessionIoError,
    });
    const customerId = yield* ensureProviderCustomer(appUser._id);
    const checkout = yield* createAdmittedCheckoutSession({
      createCheckout: polarGateway.createCheckoutSession({
        customerId,
        customerIpAddress: requestMetadata.ip,
        locale: request.polarLocale,
        productIds: request.productIds,
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
                product_count: request.productIds.length,
                product_id: Arr.join(request.productIds, ","),
              },
            },
            timestamp,
            userId: appUser._id,
          })
        ),
        Effect.mapError(checkoutSessionIoError),
        Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
      ),
    });
    return { url: checkout.url };
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
  Layer.provide(generateCustomerPortalUrl),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
