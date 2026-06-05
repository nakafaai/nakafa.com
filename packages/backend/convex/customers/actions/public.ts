import { action } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { validateCheckoutRequest } from "@repo/backend/convex/customers/checkout/impl";
import { checkoutLocaleValidator } from "@repo/backend/convex/customers/checkout/localization";
import { polarGateway } from "@repo/backend/convex/customers/polar/live";
import { requireCustomer } from "@repo/backend/convex/customers/sync/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import { v } from "convex/values";
import { Effect } from "effect";

/**
 * Create one authenticated Polar checkout session after validating the selected
 * products, redirect URL, and request-derived customer IP against backend-owned
 * policy.
 *
 * References:
 * - https://polar.sh/docs/features/checkout/session
 * - https://vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions
 */
export const generateCheckoutLink = action({
  args: {
    customerIpAddress: v.union(v.string(), v.null()),
    locale: checkoutLocaleValidator,
    productIds: v.array(v.string()),
    successUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const { appUser } = await requireAuthForAction(ctx);
    const appUserId = appUser._id;
    const { checkout, request } = await runConvexProgram(
      Effect.gen(function* () {
        const request = yield* validateCheckoutRequest(args);
        const customer = yield* requireCustomer(ctx, appUserId);
        const checkout = yield* polarGateway.createCheckoutSession({
          customerId: customer.id,
          customerIpAddress: request.customerIpAddress,
          locale: request.polarLocale,
          productIds: [...request.productIds],
          successUrl: request.successUrl,
        });

        return { checkout, request };
      })
    );

    await captureProductEvent(ctx, {
      distinctId: appUserId,
      event: {
        name: "checkout started",
        properties: {
          checkout_locale: request.polarLocale,
          customer_ip_available: request.customerIpAddress !== null,
          locale: request.locale,
          product_count: request.productIds.length,
          product_id: request.primaryProductId,
        },
      },
      timestamp: new Date(),
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
  handler: async (ctx): Promise<{ url: string }> => {
    const { appUser } = await requireAuthForAction(ctx);

    return runConvexProgram(
      Effect.gen(function* () {
        const customer = yield* requireCustomer(ctx, appUser._id);
        return yield* polarGateway.createCustomerPortalSession(customer.id);
      })
    );
  },
});
