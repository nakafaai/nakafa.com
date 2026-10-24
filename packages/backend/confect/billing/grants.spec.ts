import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { SubscriptionPlanSyncIoError } from "@repo/backend/confect/triggers/subscriptions/spec";
import { Schema } from "effect";

/**
 * Recomputes one user's plan from their Pro grants. The scheduler runs it at the
 * end of each grant, and a subscription write runs it when the grant changes.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "project",
    args: () => ({
      userId: IdSchema("users"),
    }),
    returns: () => Schema.Null,
    error: () => SubscriptionPlanSyncIoError,
  }).middleware(Atomic)
);
