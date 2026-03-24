import { internal } from "@repo/backend/convex/_generated/api";
import { action, internalAction } from "@repo/backend/convex/_generated/server";
import {
  createPolarCheckoutSession,
  createPolarCustomerPortalSession,
  deletePolarCustomer,
} from "@repo/backend/convex/customers/polar";
import {
  requireCustomer,
  syncCustomerForUser,
} from "@repo/backend/convex/customers/utils";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { products } from "@repo/backend/convex/utils/polar";
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
 * Sync customer between Polar and local database.
 * For scheduling from auth triggers.
 * Reuses the shared customer sync helper so Polar and local writes stay aligned.
 */
export const syncCustomer = internalAction({
  args: { userId: vv.id("users") },
  returns: vv.nullable(vv.id("customers")),
  handler: async (ctx, args) => {
    const [user, localCustomer] = await Promise.all([
      ctx.runQuery(internal.users.queries.getUserById, {
        userId: args.userId,
      }),
      ctx.runQuery(internal.customers.queries.getCustomerByUserId, {
        userId: args.userId,
      }),
    ]);

    if (!user) {
      return null;
    }

    const customer = await syncCustomerForUser(ctx, {
      localCustomerId: localCustomer?.id,
      user,
    });

    return customer.localCustomerId;
  },
});

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

/**
 * Clean up all user-related data when user is deleted.
 * Called from auth trigger when Better Auth user is deleted.
 * Deletes Polar customer to prevent orphaned customers that cause email conflicts.
 */
export const cleanupUserData = internalAction({
  args: { userId: vv.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.runQuery(
      internal.customers.queries.getCustomerByUserId,
      { userId: args.userId }
    );

    if (customer?.id) {
      await deletePolarCustomer(customer.id);

      await ctx.runMutation(internal.customers.mutations.deleteCustomerById, {
        id: customer.id,
      });
    }

    return null;
  },
});
