import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  PolarCheckoutErrorWire,
  PolarCustomerErrorWire,
  PolarDuplicateEmailErrorWire,
  PolarPortalErrorWire,
  PolarUpdateErrorWire,
} from "@repo/backend/confect/billing/polar/spec";
import {
  CheckoutSessionIoErrorWire,
  CheckoutUnavailable,
  checkoutRequestInputValidator,
  InvalidCheckoutSuccessUrl,
} from "@repo/backend/confect/billing/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { Schema } from "effect";

/** The hosted checkout or customer portal URL the learner is sent to. */
const sessionUrlValidator = Schema.Struct({
  url: Schema.String,
});

/** The learner's billing sessions: a Pro checkout and the customer portal. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCheckoutLink",
      args: () => checkoutRequestInputValidator.fields,
      returns: () => sessionUrlValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          SiteConfigError,
          InvalidCheckoutSuccessUrl,
          CheckoutSessionIoErrorWire,
          CheckoutUnavailable,
          PolarCustomerErrorWire,
          PolarDuplicateEmailErrorWire,
          PolarCheckoutErrorWire,
          PolarUpdateErrorWire,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCustomerPortalUrl",
      args: () => ({}),
      returns: () => sessionUrlValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          CheckoutSessionIoErrorWire,
          CheckoutUnavailable,
          PolarCustomerErrorWire,
          PolarDuplicateEmailErrorWire,
          PolarPortalErrorWire,
          PolarUpdateErrorWire,
        ]),
    }).middleware(Session)
  );
