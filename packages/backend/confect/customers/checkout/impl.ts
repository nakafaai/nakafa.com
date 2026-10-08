import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { getPolarCheckoutLocale } from "@repo/backend/confect/customers/checkout/localization";
import {
  type CheckoutAdmission,
  type CheckoutRequest,
  type CheckoutRequestInput,
  type CheckoutSessionIoError,
  InvalidCheckoutSuccessUrl,
  invalidCheckoutSuccessUrlCode,
} from "@repo/backend/confect/customers/checkout/spec";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { products } from "@repo/backend/confect/utils/polar/products";
import { Effect } from "effect";

type CheckoutAdmissionUser = Parameters<typeof isAccountDeletionPending>[0];
type CaptureCheckoutEvent<R = never> = () => Effect.Effect<void, never, R>;
type LoadCheckoutUser<R = never> = () => Effect.Effect<
  CheckoutAdmissionUser | null,
  CheckoutSessionIoError,
  R
>;
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
  const siteUrl = yield* readSiteUrl();
  const successUrl = yield* Effect.try({
    try: () => new URL(input.successUrl),
    catch: () =>
      invalidSuccessUrl("Checkout success URL must be a valid absolute URL."),
  });
  if (successUrl.origin !== siteUrl.origin) {
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
)(function* <R>(
  captureEvent: CaptureCheckoutEvent<R>,
  loadUser: LoadCheckoutUser<R>
) {
  const user = yield* loadUser();
  if (!user || isAccountDeletionPending(user)) {
    return {
      kind: "unavailable",
    } satisfies CheckoutAdmission;
  }
  yield* captureEvent();
  return {
    kind: "admitted",
  } satisfies CheckoutAdmission;
});
