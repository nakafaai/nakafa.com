import { FunctionSpec, GroupSpec } from "@confect/core";
import { GrantOwnerMismatch } from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * The one-time copy of stored Polar subscriptions into the billing tables. The
 * operator runs it page by page from the dashboard or the CLI, and it is removed
 * with its tests once dev and prod are verified.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "copyPolarSubscriptionsPage",
    args: () => ({
      cursor: Schema.NullOr(Schema.String),
      numItems: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    }),
    returns: () =>
      Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        copied: Schema.Int,
        skipped: Schema.Int,
      }),
    error: () => GrantOwnerMismatch,
  }).middleware(Atomic)
);
