import { DatabaseReader, FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { resolvePolarCustomerWebhookTarget } from "@repo/backend/confect/customers/polar/target";
import spec from "@repo/backend/confect/customers/queries/internal/customer.spec";
import { Effect, Layer } from "effect";

const getCustomerByUserId = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCustomerByUserId",
  Effect.fn("customers.queries.internal.customer.getCustomerByUserId")(
    function* (args) {
      const ctx = yield* QueryCtxService;
      const database = DatabaseReader.make(databaseSchema, ctx.db);
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
    const ctx = yield* QueryCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
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
      const ctx = yield* QueryCtxService;
      return yield* resolvePolarCustomerWebhookTarget(ctx, args);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getCustomerByUserId),
  Layer.provide(getCustomerDeletionCheckpoint),
  Layer.provide(resolveWebhookTarget),
  GroupImpl.finalize
);
