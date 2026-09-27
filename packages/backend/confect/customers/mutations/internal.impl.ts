import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  completeCustomerDeletionCheckpointProgram,
  deleteCustomerByIdProgram,
  recordCustomerDeletionCheckpointProgram,
} from "@repo/backend/confect/customers/deletion/billingState";
import spec from "@repo/backend/confect/customers/mutations/internal.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const deleteCustomerById = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteCustomerById",
  Effect.fn("customers.mutations.internal.deleteCustomerById")(
    function* (args) {
      return yield* deleteCustomerByIdProgram(args.id);
    }
  )
);
const recordCustomerDeletionCheckpoint = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordCustomerDeletionCheckpoint",
  Effect.fn("customers.mutations.internal.recordCustomerDeletionCheckpoint")(
    function* (args) {
      yield* recordCustomerDeletionCheckpointProgram(
        args.polarCustomerId,
        args.userId
      );
      return null;
    }
  )
);
const completeCustomerDeletionCheckpoint = FunctionImpl.make(
  databaseSchema,
  spec,
  "completeCustomerDeletionCheckpoint",
  Effect.fn("customers.mutations.internal.completeCustomerDeletionCheckpoint")(
    function* (args) {
      yield* completeCustomerDeletionCheckpointProgram(
        args.userId,
        args.polarCustomerId
      );
      return null;
    }
  )
);
const upsertCustomer = FunctionImpl.make(
  databaseSchema,
  spec,
  "upsertCustomer",
  Effect.fn("customers.mutations.internal.upsertCustomer")(function* (args) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const tombstone = yield* database
      .table("customerDeletionTombstones")
      .get("by_polarCustomerId", args.customer.id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (tombstone) {
      return {
        kind: "deleted",
      };
    }
    const user = yield* database
      .table("users")
      .get(args.customer.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user) {
      return {
        kind: "missing",
      };
    }
    if (user.deletedAt !== undefined) {
      return {
        kind: "deleted",
      };
    }
    if (user.deletionPreparedAt !== undefined) {
      return {
        kind: "prepared",
      };
    }
    const existingByUser = yield* database
      .table("customers")
      .get("by_userId", args.customer.userId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const existingByPolarId = yield* database
      .table("customers")
      .get("by_polarId", args.customer.id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const existing = existingByPolarId ?? existingByUser;
    if (existing) {
      yield* writer
        .table("customers")
        .patch(existing._id, {
          externalId: args.customer.externalId,
          id: args.customer.id,
          metadata: args.customer.metadata,
          userId: args.customer.userId,
        })
        .pipe(Effect.orDie);
      if (
        existingByUser &&
        existingByPolarId &&
        existingByUser._id !== existingByPolarId._id
      ) {
        yield* writer.table("customers").delete(existingByUser._id);
      }
      return {
        customerId: existing._id,
        kind: "stored",
      };
    }
    const customerId = yield* writer
      .table("customers")
      .insert(args.customer)
      .pipe(Effect.orDie);
    return {
      customerId,
      kind: "stored",
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(deleteCustomerById),
  Layer.provide(recordCustomerDeletionCheckpoint),
  Layer.provide(completeCustomerDeletionCheckpoint),
  Layer.provide(upsertCustomer),
  Layer.provide(atomic),
  GroupImpl.finalize
);
