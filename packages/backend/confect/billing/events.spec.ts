import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { PolarCustomerErrorWire } from "@repo/backend/confect/billing/polar/spec";
import {
  billingEventAppliedValidator,
  billingEventDeliveryValidator,
  unprocessedBillingEventValidator,
} from "@repo/backend/confect/billing/schema";
import {
  BillingRowMissing,
  BillingStateError,
  GrantOwnerMismatch,
} from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * The webhook inbox. Provider routes store each delivery through `record`, which
 * schedules `process` to apply it. `process` applies a delivery and resolves a
 * Polar customer Nakafa does not know yet; `sweep` reapplies deliveries that stayed
 * unprocessed, and the daily cron deletes the expired rows through `cleanup`.
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
      name: "apply",
      args: () => ({
        eventId: IdSchema("billingEvents"),
      }),
      returns: () => billingEventAppliedValidator,
      error: () => Schema.Union([BillingRowMissing, GrantOwnerMismatch]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "process",
      args: () => ({
        eventId: IdSchema("billingEvents"),
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          BillingRowMissing,
          GrantOwnerMismatch,
          PolarCustomerErrorWire,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Int,
      error: () => BillingStateError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listUnprocessed",
      args: () => ({
        receivedFrom: Schema.Finite,
        receivedBefore: Schema.Finite,
        limit: Schema.Int,
      }),
      returns: () => Schema.Array(unprocessedBillingEventValidator),
      error: () => BillingStateError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanup",
      args: () => ({}),
      returns: () => Schema.Int,
      error: () => BillingStateError,
    }).middleware(Atomic)
  );
