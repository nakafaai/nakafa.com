import { polarCheckoutDefaultLocale } from "@repo/backend/convex/customers/checkout/localization";
import {
  type CheckoutRequest,
  type CheckoutRequestInput,
  InvalidCheckoutSuccessUrl,
  invalidCheckoutSuccessUrlCode,
} from "@repo/backend/convex/customers/checkout/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { Effect } from "effect";

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
    return yield* Effect.fail(
      invalidSuccessUrl(
        "Checkout success URL must stay on the primary site origin."
      )
    );
  }

  return {
    locale: input.locale,
    polarLocale: polarCheckoutDefaultLocale,
    primaryProductId: products.pro.id,
    productIds: checkoutProductIds,
    successUrl: input.successUrl,
  } satisfies CheckoutRequest;
});
