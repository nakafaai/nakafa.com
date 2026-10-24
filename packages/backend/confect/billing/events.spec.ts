import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { billingEventDeliveryValidator } from "@repo/backend/confect/billing/schema";
import { BillingStateError } from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * The webhook inbox. Provider routes store each delivery through `record`, and
 * the daily cron deletes the expired rows through `cleanup`.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "record",
      args: () => billingEventDeliveryValidator.fields,
      returns: () =>
        Schema.Struct({
          kind: Schema.Literals(["accepted", "duplicate"]),
          eventId: IdSchema("billingEvents"),
        }),
      error: () => BillingStateError,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanup",
      args: () => ({}),
      returns: () => Schema.Int,
      error: () => BillingStateError,
    }).middleware(Atomic)
  );
