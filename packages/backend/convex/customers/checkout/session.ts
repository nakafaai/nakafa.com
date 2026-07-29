import type { CheckoutSessionIoError } from "@repo/backend/convex/customers/checkout/spec";
import type {
  CheckoutSessionResult,
  PolarCheckoutError,
} from "@repo/backend/convex/customers/polar/spec";
import { Effect } from "effect";

interface CheckoutSessionOperations {
  readonly admitCheckout: () => Effect.Effect<boolean, CheckoutSessionIoError>;
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
  const isActive = yield* operations.admitCheckout();

  return isActive ? checkout : null;
});
