import { DatabaseReader, FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/customers/integrity/internal.spec";
import { Effect, Layer } from "effect";

const listUsersForCustomerIntegrity = FunctionImpl.make(
  databaseSchema,
  spec,
  "listUsersForCustomerIntegrity",
  Effect.fn("customers.integrity.internal.listUsersForCustomerIntegrity")(
    function* (args) {
      const ctx = yield* QueryCtxService;
      const rows = yield* DatabaseReader.make(databaseSchema, ctx.db)
        .table("users")
        .index("by_creation_time")
        .paginate(args.paginationOpts)
        .pipe(Effect.orDie);
      return {
        continueCursor: rows.continueCursor,
        isDone: rows.isDone,
        page: rows.page.map((row) => ({
          authId: row.authId,
          email: row.email,
          userId: row._id,
        })),
      };
    }
  )
);
const listCustomersForIntegrity = FunctionImpl.make(
  databaseSchema,
  spec,
  "listCustomersForIntegrity",
  Effect.fn("customers.integrity.internal.listCustomersForIntegrity")(
    function* (args) {
      const ctx = yield* QueryCtxService;
      const rows = yield* DatabaseReader.make(databaseSchema, ctx.db)
        .table("customers")
        .index("by_creation_time")
        .paginate(args.paginationOpts)
        .pipe(Effect.orDie);
      return {
        continueCursor: rows.continueCursor,
        isDone: rows.isDone,
        page: rows.page.map((row) => ({
          externalId: row.externalId,
          localCustomerId: row._id,
          polarCustomerId: row.id,
          userId: row.userId,
        })),
      };
    }
  )
);
const listActiveSubscriptionsForIntegrity = FunctionImpl.make(
  databaseSchema,
  spec,
  "listActiveSubscriptionsForIntegrity",
  Effect.fn("customers.integrity.internal.listActiveSubscriptionsForIntegrity")(
    function* (args) {
      const ctx = yield* QueryCtxService;
      const database = DatabaseReader.make(databaseSchema, ctx.db);
      const rows = yield* database
        .table("subscriptions")
        .index("by_status", (q) => q.eq("status", "active"))
        .paginate(args.paginationOpts)
        .pipe(Effect.orDie);
      return {
        continueCursor: rows.continueCursor,
        isDone: rows.isDone,
        page: rows.page.map((row) => ({
          currentPeriodEnd: row.currentPeriodEnd,
          customerId: row.customerId,
          status: row.status,
          subscriptionId: row.id,
        })),
      };
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(listUsersForCustomerIntegrity),
  Layer.provide(listCustomersForIntegrity),
  Layer.provide(listActiveSubscriptionsForIntegrity),
  GroupImpl.finalize
);
