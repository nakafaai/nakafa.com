import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { PolarDeleteErrorWire } from "@repo/backend/confect/billing/polar/spec";
import { BillingStateErrorWire } from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** One personal billing account of a deleted user: the rail it pays through and its provider customer. */
const deletionAccountValidator = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  rail: Schema.Literals(["polar", "xendit"]),
  providerCustomerId: Schema.NullOr(Schema.String),
});
export type DeletionAccount = typeof deletionAccountValidator.Type;

/**
 * Deletes the billing state of one deleted user. The provider customers are
 * erased first, then the rows; a retry finds the same accounts and deletes
 * nothing twice, because a customer Polar no longer holds counts as deleted.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "readAccounts",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Array(deletionAccountValidator),
      error: () => BillingStateErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteRows",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Boolean,
      error: () => BillingStateErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "cleanupDeletedUserBilling",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([BillingStateErrorWire, PolarDeleteErrorWire]),
    })
  );
