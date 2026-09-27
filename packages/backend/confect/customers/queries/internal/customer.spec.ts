import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import customersTable from "@repo/backend/confect/_generated/tables/customers";
import {
  PolarCustomerWebhookTargetIoErrorWire,
  polarCustomerWebhookTargetValidator,
} from "@repo/backend/confect/customers/polar/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCustomerByUserId",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.NullOr(customersTable.Doc),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCustomerDeletionCheckpoint",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.NullOr(Schema.String),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "resolveWebhookTarget",
      args: () => ({
        externalId: Schema.optionalKey(Schema.String),
        metadataUserId: Schema.optionalKey(Schema.String),
        polarCustomerId: Schema.String,
      }),
      returns: () => polarCustomerWebhookTargetValidator,
      error: () => PolarCustomerWebhookTargetIoErrorWire,
    })
  );
