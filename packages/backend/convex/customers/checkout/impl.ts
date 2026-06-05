import { polarCheckoutDefaultLocale } from "@repo/backend/convex/customers/checkout/localization";
import {
  type CheckoutRequest,
  type CheckoutRequestInput,
  InvalidCheckoutProductSelection,
  InvalidCheckoutSuccessUrl,
  invalidCheckoutProductSelectionCode,
  invalidCheckoutSuccessUrlCode,
} from "@repo/backend/convex/customers/checkout/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { Effect } from "effect";

const allowedCheckoutProductIds = new Set(
  Object.values(products).map((product) => product.id)
);

const invalidProductSelection = (message: string) =>
  new InvalidCheckoutProductSelection({
    code: invalidCheckoutProductSelectionCode,
    message,
  });

const invalidSuccessUrl = (message: string) =>
  new InvalidCheckoutSuccessUrl({
    code: invalidCheckoutSuccessUrlCode,
    message,
  });

function hasProductId(
  productIds: readonly string[]
): productIds is readonly [string, ...string[]] {
  return productIds.length > 0;
}

/**
 * Validate checkout products and redirect target before contacting Polar.
 */
export const validateCheckoutRequest: (
  input: CheckoutRequestInput
) => Effect.Effect<
  CheckoutRequest,
  InvalidCheckoutProductSelection | InvalidCheckoutSuccessUrl
> = Effect.fn("customers.checkout.validateCheckoutRequest")(function* (
  input: CheckoutRequestInput
) {
  if (!hasProductId(input.productIds)) {
    return yield* Effect.fail(
      invalidProductSelection("Checkout requires at least one allowed product.")
    );
  }

  for (const productId of input.productIds) {
    if (allowedCheckoutProductIds.has(productId)) {
      continue;
    }

    return yield* Effect.fail(
      invalidProductSelection("Checkout requested an unsupported product.")
    );
  }

  const [primaryProductId] = input.productIds;

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
    customerIpAddress: input.customerIpAddress,
    locale: input.locale,
    polarLocale: polarCheckoutDefaultLocale,
    primaryProductId,
    productIds: input.productIds,
    successUrl: input.successUrl,
  };
});
