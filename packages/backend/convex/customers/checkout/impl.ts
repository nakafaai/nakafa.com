import type { ProductAnalyticsCaptureError } from "@repo/backend/convex/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { getPolarCheckoutLocale } from "@repo/backend/convex/customers/checkout/localization";
import {
  type CheckoutRequest,
  type CheckoutRequestInput,
  checkoutSessionIoError,
  InvalidCheckoutSuccessUrl,
  invalidCheckoutSuccessUrlCode,
} from "@repo/backend/convex/customers/checkout/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { Effect } from "effect";

type CheckoutAdmissionUser = Parameters<typeof isAccountDeletionPending>[0];

interface CheckoutAdmissionOperations {
  readonly captureEvent: () => Effect.Effect<
    boolean,
    ProductAnalyticsCaptureError
  >;
  readonly loadUser: () => Promise<CheckoutAdmissionUser | null>;
}

const checkoutProductIds = [products.pro.id] as const;

const invalidSuccessUrl = (message: string) =>
  new InvalidCheckoutSuccessUrl({
    code: invalidCheckoutSuccessUrlCode,
    message,
  });

/**
 * Validate caller-controlled checkout redirect input before contacting Polar.
 */
export const validateCheckoutRequest = Effect.fn(
  "customers.checkout.validateCheckoutRequest"
)(function* (input: CheckoutRequestInput) {
  const successUrl = yield* Effect.try({
    try: () => new URL(input.successUrl),
    catch: () =>
      invalidSuccessUrl("Checkout success URL must be a valid absolute URL."),
  });

  if (successUrl.origin !== siteOrigin) {
    return yield* invalidSuccessUrl(
      "Checkout success URL must stay on the primary site origin."
    );
  }

  return {
    locale: input.locale,
    polarLocale: getPolarCheckoutLocale(input.locale),
    primaryProductId: products.pro.id,
    productIds: checkoutProductIds,
    successUrl: input.successUrl,
  } satisfies CheckoutRequest;
});

/** Revalidates account access after Polar IO without gating sales on analytics. */
export const admitCheckoutProgram = Effect.fn(
  "customers.checkout.admitCheckout"
)(function* (operations: CheckoutAdmissionOperations) {
  const user = yield* Effect.tryPromise({
    try: operations.loadUser,
    catch: checkoutSessionIoError,
  });

  if (!user || isAccountDeletionPending(user)) {
    return false;
  }

  yield* operations
    .captureEvent()
    .pipe(
      Effect.catchTag("ProductAnalyticsCaptureError", (error) =>
        Effect.logWarning("Checkout analytics capture failed.").pipe(
          Effect.annotateLogs({ code: error.code, reason: error.message })
        )
      )
    );

  return true;
});
