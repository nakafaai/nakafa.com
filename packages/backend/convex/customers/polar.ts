import { checkoutsCreate } from "@polar-sh/sdk/funcs/checkoutsCreate.js";
import { customerSessionsCreate } from "@polar-sh/sdk/funcs/customerSessionsCreate.js";
import { customersCreate } from "@polar-sh/sdk/funcs/customersCreate.js";
import { customersDelete } from "@polar-sh/sdk/funcs/customersDelete.js";
import { customersGet } from "@polar-sh/sdk/funcs/customersGet.js";
import { customersGetExternal } from "@polar-sh/sdk/funcs/customersGetExternal.js";
import { customersUpdate } from "@polar-sh/sdk/funcs/customersUpdate.js";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { polarClient } from "@repo/backend/convex/utils/polar";
import { ConvexError, v } from "convex/values";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Sanitize object for Convex compatibility.
 * Converts ISO date strings to timestamps.
 */
function sanitize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
        return new Date(value).getTime();
      }
      return value;
    })
  );
}

/**
 * Polar metadata validator for action args.
 * Uses v.any() because this is passed directly to Polar's SDK.
 * The shape is defined by Polar's API, not by us.
 */
const polarMetadataArgsValidator = v.optional(v.record(v.string(), v.any()));

/**
 * Get or create customer in Polar.
 * Idempotent: handles race conditions by checking for existing customer on create failure.
 * Single action that combines get + create logic to reduce runAction overhead.
 */
export const ensureCustomer = internalAction({
  args: {
    localCustomerId: v.optional(v.string()),
    externalId: v.string(),
    email: v.string(),
    name: v.string(),
    metadata: polarMetadataArgsValidator,
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    // 1. If we have a local customer ID, verify it exists in Polar
    if (args.localCustomerId) {
      try {
        const result = await customersGet(polarClient, {
          id: args.localCustomerId,
        });
        if (result.ok) {
          return sanitize(result.value);
        }
      } catch {
        // Customer doesn't exist in Polar, continue to find/create
      }
    }

    // 2. Try to find by externalId (handles case where customer was recreated)
    try {
      const result = await customersGetExternal(polarClient, {
        externalId: args.externalId,
      });
      if (result.ok) {
        return sanitize(result.value);
      }
    } catch {
      // Not found, continue to create
    }

    // 3. Create new customer
    let createError: unknown;
    try {
      const createResult = await customersCreate(polarClient, {
        externalId: args.externalId,
        email: args.email,
        name: args.name,
        metadata: args.metadata,
      });

      if (createResult.ok) {
        return sanitize(createResult.value);
      }
      createError = createResult.error;
    } catch (error) {
      // Create threw (network error, duplicate, etc.) - continue to retry
      createError = error;
    }

    // 4. If create failed (race condition), try to get by externalId again
    try {
      const retryResult = await customersGetExternal(polarClient, {
        externalId: args.externalId,
      });
      if (retryResult.ok) {
        return sanitize(retryResult.value);
      }
    } catch {
      // Fall through to error
    }

    throw new ConvexError({
      code: "POLAR_CUSTOMER_ERROR",
      message: "Failed to ensure customer in Polar",
      detail: String(createError),
    });
  },
});

/**
 * Update customer metadata in Polar
 */
export const updateCustomerMetadata = internalAction({
  args: {
    id: v.string(),
    metadata: v.record(v.string(), v.any()), // Polar SDK metadata - shape defined by Polar
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const result = await customersUpdate(polarClient, {
      id: args.id,
      customerUpdate: {
        metadata: args.metadata,
      },
    });
    if (!result.ok) {
      throw new ConvexError({
        code: "POLAR_UPDATE_ERROR",
        message: "Failed to update customer metadata",
        detail: String(result.error),
      });
    }
    return sanitize(result.value);
  },
});

/**
 * Create checkout session in Polar
 */
export const createCheckoutSession = internalAction({
  args: {
    customerId: v.string(),
    productIds: v.array(v.string()),
    successUrl: v.string(),
    embedOrigin: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const result = await checkoutsCreate(polarClient, {
      allowDiscountCodes: true,
      customerId: args.customerId,
      products: args.productIds,
      successUrl: args.successUrl,
      embedOrigin: args.embedOrigin,
      subscriptionId: args.subscriptionId,
    });
    if (!result.ok) {
      throw new ConvexError({
        code: "POLAR_CHECKOUT_ERROR",
        message: "Failed to create checkout session",
        detail: String(result.error),
      });
    }
    return sanitize(result.value);
  },
});

/**
 * Create customer portal session in Polar
 */
export const createCustomerPortalSession = internalAction({
  args: {
    customerId: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (_ctx, args) => {
    const result = await customerSessionsCreate(polarClient, {
      customerId: args.customerId,
    });
    if (!result.ok) {
      throw new ConvexError({
        code: "POLAR_PORTAL_ERROR",
        message: "Failed to create customer portal session",
        detail: String(result.error),
      });
    }
    return { url: result.value.customerPortalUrl };
  },
});

/**
 * Delete customer from Polar.
 * Used when user account is deleted to clean up orphaned customers.
 */
export const deleteCustomer = internalAction({
  args: {
    id: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const result = await customersDelete(polarClient, { id: args.id });
    if (!result.ok) {
      throw new ConvexError({
        code: "POLAR_DELETE_ERROR",
        message: "Failed to delete customer from Polar",
        detail: String(result.error),
      });
    }

    return null;
  },
});
