import { action } from "@repo/backend/convex/_generated/server";
import { validateCheckoutRequest } from "@repo/backend/convex/customers/checkout/impl";
import { checkoutLocaleValidator } from "@repo/backend/convex/customers/checkout/localization";
import { createAdmittedCheckoutSession } from "@repo/backend/convex/customers/checkout/session";
import {
  type CheckoutAdmissionArgs,
  checkoutSessionIoError,
} from "@repo/backend/convex/customers/checkout/spec";
import { polarGateway } from "@repo/backend/convex/customers/polar/live";
import { requireCustomer } from "@repo/backend/convex/customers/sync/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  accountUnavailableError,
  requireAuthForAction,
} from "@repo/backend/convex/lib/helpers/auth";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const admitCheckoutSessionReference = makeFunctionReference<
  "mutation",
  CheckoutAdmissionArgs,
  boolean
>("customers/checkout/admission:admitCheckoutSession");

/**
 * Create one authenticated Polar checkout session after validating the selected
 * product, redirect URL, and Convex request metadata against backend-owned
 * policy.
 *
 * References:
 * - https://docs.convex.dev/api/interfaces/server.ActionMeta#getrequestmetadata
 * - https://docs.convex.dev/functions/actions
 * - https://polar.sh/docs/features/checkout/session
 */
export const generateCheckoutLink = action({
  args: {
    locale: checkoutLocaleValidator,
    successUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthForAction(ctx);
    const appUserId = appUser._id;
    const checkout = await runConvexProgram(
      Effect.gen(function* () {
        const request = yield* validateCheckoutRequest(args);
        const requestMetadata = yield* Effect.tryPromise({
          try: () => ctx.meta.getRequestMetadata(),
          catch: checkoutSessionIoError,
        });
        const customer = yield* requireCustomer(ctx, appUserId);
        const checkout = yield* createAdmittedCheckoutSession({
          createCheckout: () =>
            polarGateway.createCheckoutSession({
              customerId: customer.id,
              customerIpAddress: requestMetadata.ip,
              locale: request.polarLocale,
              productIds: [...request.productIds],
              successUrl: request.successUrl,
            }),
          admitCheckout: () =>
            Effect.tryPromise({
              try: () =>
                ctx.runMutation(admitCheckoutSessionReference, {
                  event: {
                    name: "checkout started",
                    properties: {
                      checkout_locale: request.polarLocale,
                      customer_ip_available: requestMetadata.ip !== null,
                      locale: request.locale,
                      product_count: request.productIds.length,
                      product_id: request.primaryProductId,
                    },
                  },
                  timestamp: Date.now(),
                  userId: appUserId,
                }),
              catch: checkoutSessionIoError,
            }),
        });

        return checkout;
      })
    );

    if (!checkout) {
      throw accountUnavailableError();
    }

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

    return runConvexProgram(
      Effect.gen(function* () {
        const customer = yield* requireCustomer(ctx, appUser._id);
        return yield* polarGateway.createCustomerPortalSession(customer.id);
      })
    );
  },
});
