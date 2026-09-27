import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import customers from "@repo/backend/confect/_generated/tables/customers";
import { customerUpsertResultValidator } from "@repo/backend/confect/customers/mutations/spec";
import { CustomerSyncIoErrorWire } from "@repo/backend/confect/customers/sync/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteCustomerById",
      args: () =>
        Schema.Struct({
          id: Schema.String,
        }).fields,
      returns: () => Schema.Boolean,
      error: () => CustomerSyncIoErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recordCustomerDeletionCheckpoint",
      args: () => ({
        polarCustomerId: Schema.String,
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () => CustomerSyncIoErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "completeCustomerDeletionCheckpoint",
      args: () => ({
        polarCustomerId: Schema.String,
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () => CustomerSyncIoErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "upsertCustomer",
      args: () => ({
        customer: customers.Fields,
      }),
      returns: () => customerUpsertResultValidator,
    }).middleware(Atomic)
  );
