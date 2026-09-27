import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { resolvePolarCustomerWebhookTarget } from "@repo/backend/confect/customers/polar/target";
import spec from "@repo/backend/confect/customers/queries/internal/customer.spec";
import { Effect, Layer } from "effect";

const getCustomerByUserId = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCustomerByUserId",
  Effect.fn("customers.queries.internal.customer.getCustomerByUserId")(
    function* (args) {
      const database = yield* DatabaseReader;
      const customer = yield* database
        .table("customers")
        .get("by_userId", args.userId)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      return customer;
    }
  )
);
const getCustomerDeletionCheckpoint = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCustomerDeletionCheckpoint",
  Effect.fn(
    "customers.queries.internal.customer.getCustomerDeletionCheckpoint"
  )(function* (args) {
    const database = yield* DatabaseReader;
    const tombstone = yield* database
      .table("customerDeletionTombstones")
      .get("by_cleanupUserId", args.userId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return tombstone?.polarCustomerId ?? null;
  })
);
const resolveWebhookTarget = FunctionImpl.make(
  databaseSchema,
  spec,
  "resolveWebhookTarget",
  Effect.fn("customers.queries.internal.customer.resolveWebhookTarget")(
    function* (args) {
      return yield* resolvePolarCustomerWebhookTarget(args);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getCustomerByUserId),
  Layer.provide(getCustomerDeletionCheckpoint),
  Layer.provide(resolveWebhookTarget),
  GroupImpl.finalize
);
