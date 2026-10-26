import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  ProCheckoutOffer,
  XenditPlanError,
} from "@repo/backend/confect/billing/spec";
import { Schema } from "effect";

/**
 * Opens the recurring plan of an Indonesian Pro subscription once its first
 * month is paid: `read` says what the plan charges, `open` asks Xendit for it,
 * and `record` names the plan on the subscription.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({ subscriptionId: IdSchema("billingSubscriptions") }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            amount: Schema.Int,
            anchor: Schema.Finite,
            customerId: Schema.String,
            months: Schema.Int,
            offer: ProCheckoutOffer,
            tokenId: Schema.String,
          })
        ),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "record",
      args: () => ({
        subscriptionId: IdSchema("billingSubscriptions"),
        planId: Schema.String,
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "open",
      args: () => ({
        subscriptionId: IdSchema("billingSubscriptions"),
        locale: ActiveAppLocaleCodeSchema,
      }),
      returns: () => Schema.Null,
      error: () => XenditPlanError,
    })
  );
