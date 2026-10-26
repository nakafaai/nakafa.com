import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { ensureProviderCustomer } from "@repo/backend/confect/billing/customer";
import { generateTopupCheckoutLink } from "@repo/backend/confect/billing/pack";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import { generateCheckoutLink } from "@repo/backend/confect/billing/pro";
import spec from "@repo/backend/confect/billing/sessions.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

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
