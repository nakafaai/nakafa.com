import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  CheckoutSessionIoErrorWire,
  CheckoutUnavailable,
  checkoutRequestInputValidator,
  InvalidCheckoutSuccessUrl,
} from "@repo/backend/confect/customers/checkout/spec";
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
import Session from "@repo/backend/confect/middleware/session.spec";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCheckoutLink",
      args: () => checkoutRequestInputValidator.fields,
      returns: () =>
        Schema.Struct({
          url: Schema.String,
        }),
      error: () =>
        Schema.Union([
          AuthFailure,
          Schema.Union([
            SiteConfigError,
            InvalidCheckoutSuccessUrl,
            CheckoutSessionIoErrorWire,
            CustomerSyncIoErrorWire,
            UserNotFound,
            PolarCustomerErrorWire,
            PolarCustomerEmailConflictWire,
            PolarCheckoutErrorWire,
            PolarDuplicateEmailErrorWire,
            PolarPortalErrorWire,
            PolarDeleteErrorWire,
            PolarUpdateErrorWire,
            CheckoutUnavailable,
          ]),
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCustomerPortalUrl",
      args: () => ({}),
      returns: () =>
        Schema.Struct({
          url: Schema.String,
        }),
      error: () =>
        Schema.Union([
          AuthFailure,
          Schema.Union([
            CustomerSyncIoErrorWire,
            UserNotFound,
            PolarCustomerErrorWire,
            PolarCustomerEmailConflictWire,
            PolarCheckoutErrorWire,
            PolarDuplicateEmailErrorWire,
            PolarPortalErrorWire,
            PolarDeleteErrorWire,
            PolarUpdateErrorWire,
          ]),
        ]),
    }).middleware(Session)
  );
