import {
  type CheckoutAdmission,
  type CheckoutSessionIoError,
  CheckoutUnavailable,
} from "@repo/backend/convex/customers/checkout/spec";
import type {
  CheckoutSessionResult,
  PolarCheckoutError,
} from "@repo/backend/convex/customers/polar/spec";
import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/convex/lib/helpers/auth";
import { Effect } from "effect";

interface CheckoutSessionOperations {
  readonly admitCheckout: () => Effect.Effect<
    CheckoutAdmission,
    CheckoutSessionIoError
  >;
  readonly createCheckout: () => Effect.Effect<
    CheckoutSessionResult,
    PolarCheckoutError
  >;
}

/** Returns a new checkout only if the post-Polar admission remains active. */
export const createAdmittedCheckoutSession = Effect.fn(
  "customers.checkout.createAdmittedSession"
)(function* (operations: CheckoutSessionOperations) {
  const checkout = yield* operations.createCheckout();
  const admission = yield* operations.admitCheckout();

  if (admission.kind === "unavailable") {
    return yield* new CheckoutUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }

  return checkout;
});
