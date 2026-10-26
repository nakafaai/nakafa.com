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
  CheckoutOfferUnavailableWire,
  CheckoutSessionIoErrorWire,
  CheckoutUnavailable,
  checkoutRequestInputValidator,
  InvalidCheckoutSuccessUrl,
  ProAlreadyHeldWire,
  proCheckoutRequestInputValidator,
  TopupRequiresPro,
  XenditCheckoutErrorWire,
} from "@repo/backend/confect/billing/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { Schema } from "effect";

/** The hosted checkout or customer portal URL the learner is sent to. */
const sessionUrlValidator = Schema.Struct({
  url: Schema.String,
});

/** The learner's billing sessions: a Pro checkout, a top-up checkout, and the customer portal. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCheckoutLink",
      args: () => proCheckoutRequestInputValidator.fields,
      returns: () => sessionUrlValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          SiteConfigError,
          InvalidCheckoutSuccessUrl,
          CheckoutSessionIoErrorWire,
          CheckoutUnavailable,
          CheckoutOfferUnavailableWire,
          ProAlreadyHeldWire,
          PolarCustomerErrorWire,
          PolarDuplicateEmailErrorWire,
          PolarCheckoutErrorWire,
          PolarUpdateErrorWire,
          XenditCheckoutErrorWire,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateTopupCheckoutLink",
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
          TopupRequiresPro,
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
