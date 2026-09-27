import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/subscriptions/queries.spec";
import { Effect, Layer, Option } from "effect";

const hasActiveSubscription = FunctionImpl.make(
  databaseSchema,
  spec,
  "hasActiveSubscription",
  Effect.fn("subscriptions.queries.hasActiveSubscription")(function* (args) {
    const database = yield* DatabaseReader;
    const { appUser } = yield* requireAuth();
    const customer = yield* database
      .table("customers")
      .get("by_userId", appUser._id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!customer) {
      return false;
    }
    const subscription = yield* database
      .table("subscriptions")
      .index("by_customerId_and_status_and_productId", (q) =>
        q
          .eq("customerId", customer.id)
          .eq("status", "active")
          .eq("productId", args.productId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    return subscription !== null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(hasActiveSubscription),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
