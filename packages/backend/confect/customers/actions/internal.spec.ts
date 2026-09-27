import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  PolarCheckoutErrorWire,
  PolarCustomerEmailConflictWire,
  PolarCustomerErrorWire,
  PolarDeleteErrorWire,
  PolarDuplicateEmailErrorWire,
  PolarPortalErrorWire,
  PolarUpdateErrorWire,
} from "@repo/backend/confect/customers/polar/spec";
import {
  CustomerSyncIoErrorWire,
  UserNotFound,
} from "@repo/backend/confect/customers/sync/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalAction({
      name: "syncCustomer",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.NullOr(IdSchema("customers")),
      error: () =>
        Schema.Union([
          CustomerSyncIoErrorWire,
          PolarCustomerErrorWire,
          PolarCustomerEmailConflictWire,
          PolarCheckoutErrorWire,
          PolarDuplicateEmailErrorWire,
          PolarPortalErrorWire,
          PolarDeleteErrorWire,
          PolarUpdateErrorWire,
          UserNotFound,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "cleanupDeletedUserCustomerData",
      args: () => ({
        authId: Schema.String,
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          CustomerSyncIoErrorWire,
          PolarCheckoutErrorWire,
          PolarDuplicateEmailErrorWire,
          PolarCustomerErrorWire,
          PolarPortalErrorWire,
          PolarDeleteErrorWire,
          PolarUpdateErrorWire,
        ]),
    })
  );
