import { checkoutsCreate } from "@polar-sh/sdk/funcs/checkoutsCreate.js";
import { customerSessionsCreate } from "@polar-sh/sdk/funcs/customerSessionsCreate.js";
import { customersCreate } from "@polar-sh/sdk/funcs/customersCreate.js";
import { customersDelete } from "@polar-sh/sdk/funcs/customersDelete.js";
import { customersGet } from "@polar-sh/sdk/funcs/customersGet.js";
import { customersGetExternal } from "@polar-sh/sdk/funcs/customersGetExternal.js";
import { customersList } from "@polar-sh/sdk/funcs/customersList.js";
import { customersUpdate } from "@polar-sh/sdk/funcs/customersUpdate.js";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror.js";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { polarClient } from "@repo/backend/convex/utils/polar/client";
import { ConvexError } from "convex/values";

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

type PolarMetadata = Record<string, string | number | boolean>;

/** Identify Polar's not-found response so retries can fall back cleanly. */
function isMissingPolarCustomer(error: unknown) {
  return error instanceof PolarError && error.statusCode === 404;
}

/** Detect Polar's exact duplicate-email validation failure. */
function isDuplicatePolarCustomerEmailError(error: unknown) {
  if (!(error instanceof HTTPValidationError)) {
    return false;
  }

  return (error.detail ?? []).some(
    (detail) =>
      detail.loc.length === 2 &&
      detail.loc[0] === "body" &&
      detail.loc[1] === "email" &&
      detail.msg === "A customer with this email address already exists."
  );
}

/** Normalizes one Polar customer response into the subset persisted locally. */
function normalizeStoredPolarCustomer(customer: {
  email?: string | null;
  externalId?: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  name?: string | null;
}) {
  if (typeof customer.email !== "string") {
    throw new ConvexError({
      code: "POLAR_CUSTOMER_ERROR",
      message: "Polar customer is missing a valid email address.",
      detail: JSON.stringify({ polarCustomerId: customer.id }),
    });
  }

  const metadataEntries = Object.entries(customer.metadata ?? {}).filter(
    (entry): entry is [string, string | number | boolean] => {
      const value = entry[1];

      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    }
  );

  return {
    email: customer.email,
    externalId: customer.externalId ?? null,
    id: customer.id,
    metadata: Object.fromEntries(metadataEntries),
    name: customer.name ?? null,
  };
}

/** Loads the exact Polar customer that already owns one email address. */
async function findPolarCustomerByEmail(email: string) {
  const page = await customersList(polarClient, {
    email,
    limit: 1,
  });

  if (!page.ok) {
    throw page.error;
  }

  const customer = page.value.result.items[0] ?? null;

  if (!customer) {
    return null;
  }

  return normalizeStoredPolarCustomer(sanitize(customer));
}

/**
 * Keep one existing Polar customer aligned with the app's latest email, name,
 * and metadata, while staying idempotent when nothing changed.
 */
async function syncExistingCustomer(
  customer: {
    externalId?: string | null;
    id: string;
    email?: string | null;
    metadata?: Record<string, unknown> | null;
    name?: string | null;
  },
  args: {
    email: string;
    externalId: string;
    metadata?: PolarMetadata;
    name: string;
  }
) {
  const normalizedCustomer = normalizeStoredPolarCustomer(customer);
  const currentMetadata = JSON.stringify(normalizedCustomer.metadata);
  const nextMetadata = JSON.stringify(args.metadata ?? {});

  if (
    normalizedCustomer.externalId &&
    normalizedCustomer.externalId !== args.externalId
  ) {
    throw new ConvexError({
      code: "POLAR_CUSTOMER_EMAIL_CONFLICT",
      message:
        "This email is already linked to a different Polar customer identity.",
      detail: JSON.stringify({
        existingExternalId: normalizedCustomer.externalId,
        polarCustomerId: normalizedCustomer.id,
      }),
    });
  }

  if (
    normalizedCustomer.email === args.email &&
    normalizedCustomer.name === args.name &&
    currentMetadata === nextMetadata &&
    normalizedCustomer.externalId === args.externalId
  ) {
    return normalizedCustomer;
  }

  const updateResult = await customersUpdate(polarClient, {
    id: normalizedCustomer.id,
    customerUpdate: {
      email: args.email,
      externalId: args.externalId,
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

  return normalizeStoredPolarCustomer(sanitize(updateResult.value));
}

/**
 * Get or create customer in Polar.
 * Idempotent: handles race conditions by checking for existing customer on create failure.
 * Single action that combines get + create logic to reduce runAction overhead.
 */
export async function ensurePolarCustomer(args: {
  localCustomerId?: string;
  externalId: string;
  email: string;
  name: string;
  metadata?: PolarMetadata;
}) {
  if (args.localCustomerId) {
    try {
      const result = await customersGet(polarClient, {
        id: args.localCustomerId,
      });
      if (result.ok) {
        return await syncExistingCustomer(result.value, args);
      }
    } catch (error) {
      if (!isMissingPolarCustomer(error)) {
        throw error;
      }
    }
  }

  try {
    const result = await customersGetExternal(polarClient, {
      externalId: args.externalId,
    });
    if (result.ok) {
      return await syncExistingCustomer(result.value, args);
    }
  } catch (error) {
    if (!isMissingPolarCustomer(error)) {
      throw error;
    }
  }

  let createError: unknown;
  try {
    const createResult = await customersCreate(polarClient, {
      externalId: args.externalId,
      email: args.email,
      name: args.name,
      metadata: args.metadata,
    });

    if (createResult.ok) {
      return normalizeStoredPolarCustomer(sanitize(createResult.value));
    }

    createError = createResult.error;
  } catch (error) {
    createError = error;
  }

  if (isDuplicatePolarCustomerEmailError(createError)) {
    const existingCustomer = await findPolarCustomerByEmail(args.email);

    if (existingCustomer) {
      return await syncExistingCustomer(existingCustomer, args);
    }
  }

  try {
    const retryResult = await customersGetExternal(polarClient, {
      externalId: args.externalId,
    });
    if (retryResult.ok) {
      return await syncExistingCustomer(retryResult.value, args);
    }
  } catch (error) {
    if (!isMissingPolarCustomer(error)) {
      throw error;
    }
  }

  throw new ConvexError({
    code: "POLAR_CUSTOMER_ERROR",
    message: "Failed to ensure customer in Polar",
    detail: String(createError),
  });
}

/**
 * Update only the metadata fields for an already-linked Polar customer.
 */
export async function updatePolarCustomerMetadata(args: {
  id: string;
  metadata: PolarMetadata;
}) {
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
  return normalizeStoredPolarCustomer(customer);
}

/**
 * Create one Polar checkout session for the validated product selection.
 */
export async function createPolarCheckoutSession(args: {
  customerId: string;
  productIds: string[];
  successUrl: string;
  embedOrigin?: string;
  subscriptionId?: string;
}) {
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
}

/**
 * Create one Polar customer portal session for an existing customer.
 */
export async function createPolarCustomerPortalSession(args: {
  customerId: string;
}) {
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
}

/**
 * Delete customer from Polar and anonymize PII so stale emails can be reused.
 * Used when user account is deleted to clean up orphaned customers.
 */
export async function deletePolarCustomer(id: string) {
  const result = await customersDelete(polarClient, {
    anonymize: true,
    id,
  });
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
}
