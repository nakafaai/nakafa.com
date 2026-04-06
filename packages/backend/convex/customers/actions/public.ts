import { action } from "@repo/backend/convex/_generated/server";
import {
  createPolarCheckoutSession,
  createPolarCustomerPortalSession,
} from "@repo/backend/convex/customers/polar";
import { requireCustomer } from "@repo/backend/convex/customers/utils";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import { products } from "@repo/backend/convex/utils/polar/products";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { ConvexError, v } from "convex/values";

const allowedCheckoutProductIds = new Set(
  Object.values(products).map((product) => product.id)
);

/**
 * Keep checkout redirects on the primary site origin to prevent open redirect
 * behavior from user-supplied URLs.
 */
function requireAllowedSuccessUrl(successUrl: string) {
  let url: URL;

  try {
    url = new URL(successUrl);
  } catch {
    throw new ConvexError({
      code: "INVALID_SUCCESS_URL",
      message: "Checkout success URL must be a valid absolute URL.",
    });
  }

  if (url.origin === siteOrigin) {
    return successUrl;
  }

  throw new ConvexError({
    code: "INVALID_SUCCESS_URL",
    message: "Checkout success URL must stay on the primary site origin.",
  });
}

/**
 * Restrict checkout creation to the product IDs explicitly configured by the
 * backend.
 */
function requireAllowedCheckoutProducts(productIds: string[]) {
  if (productIds.length === 0) {
    throw new ConvexError({
      code: "INVALID_PRODUCT_SELECTION",
      message: "Checkout requires at least one allowed product.",
    });
  }

  for (const productId of productIds) {
    if (allowedCheckoutProductIds.has(productId)) {
      continue;
    }

    throw new ConvexError({
      code: "INVALID_PRODUCT_SELECTION",
      message: "Checkout requested an unsupported product.",
    });
  }

  return productIds;
}

/**
 * Create one authenticated Polar checkout session after validating the selected
 * products and redirect URL against backend-owned policy.
 */
export const generateCheckoutLink = action({
  args: {
    productIds: v.array(v.string()),
    successUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthForAction(ctx);
    const customer = await requireCustomer(ctx, appUser._id);
    const productIds = requireAllowedCheckoutProducts(args.productIds);
    const successUrl = requireAllowedSuccessUrl(args.successUrl);

    const checkout = await createPolarCheckoutSession({
      customerId: customer.id,
      productIds,
      successUrl,
    });

    return { url: checkout.url };
  },
});

/**
 * Create one authenticated Polar customer portal session for the current user.
 */
export const generateCustomerPortalUrl = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx) => {
    const { appUser } = await requireAuthForAction(ctx);
    const customer = await requireCustomer(ctx, appUser._id);

    return createPolarCustomerPortalSession({ customerId: customer.id });
  },
});
