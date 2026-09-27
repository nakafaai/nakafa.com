import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { checkoutLocaleValidator } from "@repo/backend/confect/customers/checkout/localization";
import {
  CheckoutSessionIoErrorWire,
  CheckoutUnavailableWire,
  InvalidCheckoutSuccessUrlWire,
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
  UserNotFoundWire,
} from "@repo/backend/confect/customers/sync/spec";
import { SiteConfigErrorWire } from "@repo/backend/confect/site/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCheckoutLink",
      args: () => ({
        locale: checkoutLocaleValidator,
        successUrl: Schema.String,
      }),
      returns: () =>
        Schema.Struct({
          url: Schema.String,
        }),
      error: () =>
        Schema.Union([
          AuthFailure,
          Schema.Union([
            SiteConfigErrorWire,
            InvalidCheckoutSuccessUrlWire,
            CheckoutSessionIoErrorWire,
            CustomerSyncIoErrorWire,
            UserNotFoundWire,
            PolarCustomerErrorWire,
            PolarCustomerEmailConflictWire,
            PolarCheckoutErrorWire,
            PolarDuplicateEmailErrorWire,
            PolarPortalErrorWire,
            PolarDeleteErrorWire,
            PolarUpdateErrorWire,
            CheckoutUnavailableWire,
          ]),
        ]),
    })
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
            UserNotFoundWire,
            PolarCustomerErrorWire,
            PolarCustomerEmailConflictWire,
            PolarCheckoutErrorWire,
            PolarDuplicateEmailErrorWire,
            PolarPortalErrorWire,
            PolarDeleteErrorWire,
            PolarUpdateErrorWire,
          ]),
        ]),
    })
  );
