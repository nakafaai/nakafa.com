import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { readBillingOverview } from "@repo/backend/confect/billing/overview";
import spec from "@repo/backend/confect/billing/queries.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Clock, Effect, Layer } from "effect";

/** The viewer's plan, subscription, and Nina credits, read at the moment of the query. */
const overview = FunctionImpl.make(
  databaseSchema,
  spec,
  "overview",
  Effect.fn("billing.queries.overview")(function* () {
    const { appUser } = yield* requireAuth();
    const now = yield* Clock.currentTimeMillis;
    return yield* readBillingOverview(appUser, now);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(overview),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
