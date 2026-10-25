import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  PolarCustomerErrorWire,
  PolarDeleteErrorWire,
} from "@repo/backend/confect/billing/polar/spec";
import {
  BillingStateErrorWire,
  XenditDeactivateErrorWire,
} from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** One personal billing account of a deleted user: the rail it pays through and its provider customer. */
const deletionAccountValidator = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  rail: Schema.Literals(["polar", "xendit"]),
  providerCustomerId: Schema.NullOr(Schema.String),
});
export type DeletionAccount = typeof deletionAccountValidator.Type;

/** One subscription of a deleted user, with the Xendit plan it bills through when it bills through Xendit. */
const deletionSubscriptionValidator = Schema.Struct({
  subscriptionId: IdSchema("billingSubscriptions"),
  xenditPlanId: Schema.NullOr(Schema.String),
});
export type DeletionSubscription = typeof deletionSubscriptionValidator.Type;

/**
 * Deletes the billing state of one deleted user. The provider customers are erased
 * first, then each batch of subscriptions has its Xendit plan turned off before its
 * rows are deleted, then the rest of the rows follow. A retry finds the same rows
 * and deletes nothing twice: a customer Polar no longer holds, or a plan Xendit
 * reports as off, counts as deleted.
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
    FunctionSpec.internalQuery({
      name: "readSubscriptions",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Array(deletionSubscriptionValidator),
      error: () => BillingStateErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteRows",
      args: () => ({
        userId: IdSchema("users"),
        subscriptionIds: Schema.Array(IdSchema("billingSubscriptions")),
      }),
      returns: () => Schema.Boolean,
      error: () => BillingStateErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "cleanupDeletedUserBilling",
      args: () => ({
        authId: Schema.String,
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          BillingStateErrorWire,
          PolarCustomerErrorWire,
          PolarDeleteErrorWire,
          XenditDeactivateErrorWire,
        ]),
    })
  );
