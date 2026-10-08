import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import {
  type CheckoutAdmission,
  type CheckoutSessionIoError,
  CheckoutUnavailable,
} from "@repo/backend/confect/customers/checkout/spec";
import type {
  CheckoutSessionResult,
  PolarCheckoutError,
} from "@repo/backend/confect/customers/polar/spec";
import { Effect } from "effect";

/** Returns a new checkout only if the post-Polar admission remains active. */
export const createAdmittedCheckoutSession = Effect.fn(
  "customers.checkout.createAdmittedSession"
)(function* (
  createCheckout: Effect.Effect<CheckoutSessionResult, PolarCheckoutError>,
  admitCheckout: Effect.Effect<CheckoutAdmission, CheckoutSessionIoError>
) {
  const checkout = yield* createCheckout;
  const admission = yield* admitCheckout;
  if (admission.kind === "unavailable") {
    return yield* new CheckoutUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  return checkout;
});
