import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import {
  SubscriptionRecordIoErrorWire,
  subscriptionRecordArgs,
} from "@repo/backend/confect/subscriptions/records/spec";
import { Schema } from "effect";
/**
 * Create a new subscription record.
 * Internal function - called by Polar webhooks only.
 * Idempotent - safe to call multiple times with same subscription.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "createSubscription",
      args: () => subscriptionRecordArgs,
      returns: () => Schema.NullOr(IdSchema("subscriptions")),
      error: () => SubscriptionRecordIoErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "updateSubscription",
      args: () => subscriptionRecordArgs,
      returns: () => Schema.Null,
      error: () => SubscriptionRecordIoErrorWire,
    }).middleware(Atomic)
  );
