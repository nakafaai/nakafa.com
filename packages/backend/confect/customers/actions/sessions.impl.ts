import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/customers/actions/sessions.spec";
import { validateCheckoutRequest } from "@repo/backend/confect/customers/checkout/impl";
import { createAdmittedCheckoutSession } from "@repo/backend/confect/customers/checkout/session";
import { checkoutSessionIoError } from "@repo/backend/confect/customers/checkout/spec";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import { requireCustomer } from "@repo/backend/confect/customers/sync/impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Clock, Effect, flow, Layer } from "effect";

const generateCheckoutLink = FunctionImpl.make(
  databaseSchema,
  spec,
  "generateCheckoutLink",
  Effect.fn("customers.actions.sessions.generateCheckoutLink")(
    function* (args) {
      const ctx = yield* ActionCtxService;
      const { appUser } = yield* requireAuth();
      const appUserId = appUser._id;
      return yield* Effect.gen(function* () {
        const runMutation = yield* MutationRunner;
        const request = yield* validateCheckoutRequest(args);
        const requestMetadata = yield* Effect.tryPromise({
          try: () => ctx.meta.getRequestMetadata(),
          catch: checkoutSessionIoError,
        });
        const customer = yield* requireCustomer(appUserId);
        const checkout = yield* createAdmittedCheckoutSession({
          createCheckout: polarGateway.createCheckoutSession({
            customerId: customer.id,
            customerIpAddress: requestMetadata.ip,
            locale: request.polarLocale,
            productIds: [...request.productIds],
            successUrl: request.successUrl,
          }),
          admitCheckout: Clock.currentTimeMillis.pipe(
            Effect.flatMap((timestamp) =>
              runMutation(
                refs.internal.customers.checkout.admission.admitCheckoutSession,
                {
                  event: {
                    name: "checkout started",
                    properties: {
                      checkout_locale: request.polarLocale,
                      customer_ip_available: requestMetadata.ip !== null,
                      locale: request.locale,
                      product_count: request.productIds.length,
                      product_id: request.primaryProductId,
                    },
                  },
                  timestamp,
                  userId: appUserId,
                }
              )
            ),
            Effect.mapError(checkoutSessionIoError),
            Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
          ),
        });
        return {
          url: checkout.url,
        };
      });
    }
  )
);
const generateCustomerPortalUrl = FunctionImpl.make(
  databaseSchema,
  spec,
  "generateCustomerPortalUrl",
  Effect.fn("customers.actions.sessions.generateCustomerPortalUrl")(
    function* () {
      const { appUser } = yield* requireAuth();
      return yield* Effect.gen(function* () {
        const customer = yield* requireCustomer(appUser._id);
        return yield* polarGateway.createCustomerPortalSession(customer.id);
      });
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(generateCheckoutLink),
  Layer.provide(generateCustomerPortalUrl),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
