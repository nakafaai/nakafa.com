import { checkoutsCreate } from "@polar-sh/sdk/funcs/checkoutsCreate.js";
import { customerSessionsCreate } from "@polar-sh/sdk/funcs/customerSessionsCreate.js";
import { customersCreate } from "@polar-sh/sdk/funcs/customersCreate.js";
import { customersDelete } from "@polar-sh/sdk/funcs/customersDelete.js";
import { customersGet } from "@polar-sh/sdk/funcs/customersGet.js";
import { customersGetExternal } from "@polar-sh/sdk/funcs/customersGetExternal.js";
import { customersUpdate } from "@polar-sh/sdk/funcs/customersUpdate.js";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { polarClient } from "@repo/backend/convex/utils/polar";
import { ConvexError, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

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
const polarMetadataValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean()
);
const polarMetadataArgsValidator = v.optional(
  v.record(v.string(), polarMetadataValueValidator)
);
type PolarMetadata = Record<string, string | number | boolean>;
const polarCustomerResultValidator = v.object({
  id: v.string(),
  externalId: nullable(v.string()),
  email: v.string(),
  name: nullable(v.string()),
  metadata: v.record(v.string(), polarMetadataValueValidator),
});

function isMissingPolarCustomer(error: unknown) {
  return error instanceof PolarError && error.statusCode === 404;
}

function toPolarCustomerResult(customer: {
  id: string;
  externalId?: string | null;
  email: string;
  metadata?: PolarMetadata | null;
  name?: string | null;
}) {
  return {
    id: customer.id,
    externalId: customer.externalId ?? null,
    email: customer.email,
    name: customer.name ?? null,
    metadata: customer.metadata ?? {},
  };
}

async function syncExistingCustomer(
  customer: {
    id: string;
    email: string;
    metadata?: PolarMetadata | null;
    name?: string | null;
  },
  args: {
    email: string;
    metadata?: PolarMetadata;
    name: string;
  }
) {
  const currentMetadata = JSON.stringify(customer.metadata ?? {});
  const nextMetadata = JSON.stringify(args.metadata ?? {});

  if (
    customer.email === args.email &&
    customer.name === args.name &&
    currentMetadata === nextMetadata
  ) {
    return toPolarCustomerResult(customer);
  }

  const updateResult = await customersUpdate(polarClient, {
    id: customer.id,
    customerUpdate: {
      email: args.email,
      metadata: args.metadata,
      name: args.name,
    },
  });

  if (!updateResult.ok) {
    throw new ConvexError({
      code: "POLAR_UPDATE_ERROR",
      message: "Failed to sync customer data in Polar",
      detail: String(updateResult.error),
    });
  }

  return toPolarCustomerResult(sanitize(updateResult.value));
}

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
  returns: polarCustomerResultValidator,
  handler: async (_ctx, args) => {
    // 1. If we have a local customer ID, verify it exists in Polar
    if (args.localCustomerId) {
      try {
        const result = await customersGet(polarClient, {
          id: args.localCustomerId,
        });
        if (result.ok) {
          return await syncExistingCustomer(sanitize(result.value), args);
        }
      } catch (error) {
        if (!isMissingPolarCustomer(error)) {
          throw error;
        }

        // Customer doesn't exist in Polar, continue to find/create
      }
    }

    // 2. Try to find by externalId (handles case where customer was recreated)
    try {
      const result = await customersGetExternal(polarClient, {
        externalId: args.externalId,
      });
      if (result.ok) {
        return await syncExistingCustomer(sanitize(result.value), args);
      }
    } catch (error) {
      if (!isMissingPolarCustomer(error)) {
        throw error;
      }

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
        return toPolarCustomerResult(sanitize(createResult.value));
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
        return await syncExistingCustomer(sanitize(retryResult.value), args);
      }
    } catch (error) {
      if (!isMissingPolarCustomer(error)) {
        throw error;
      }

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
    metadata: v.record(v.string(), polarMetadataValueValidator),
  },
  returns: polarCustomerResultValidator,
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

    const customer = sanitize(result.value);
    return toPolarCustomerResult(customer);
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
  returns: v.object({ url: v.string() }),
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

    return { url: result.value.url };
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
      if (isMissingPolarCustomer(result.error)) {
        return null;
      }

      throw new ConvexError({
        code: "POLAR_DELETE_ERROR",
        message: "Failed to delete customer from Polar",
        detail: String(result.error),
      });
    }

    return null;
  },
});
