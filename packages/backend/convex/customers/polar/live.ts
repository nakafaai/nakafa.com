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
import {
  PolarCheckoutError,
  PolarCustomerError,
  type PolarCustomerGateway,
  PolarDeleteError,
  PolarDuplicateEmailError,
  PolarPortalError,
  PolarUpdateError,
  polarCheckoutErrorCode,
  polarCustomerErrorCode,
  polarDeleteErrorCode,
  polarDuplicateEmailCode,
  polarPortalErrorCode,
  polarUpdateErrorCode,
} from "@repo/backend/convex/customers/polar/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { polarClient } from "@repo/backend/convex/utils/polar/client";
import { Effect } from "effect";

/** Identify Polar's not-found response so customer sync can recreate rows. */
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

function polarCustomerError(message: string, error: unknown) {
  if (isDuplicatePolarCustomerEmailError(error)) {
    return new PolarDuplicateEmailError({
      code: polarDuplicateEmailCode,
      message: "A Polar customer already exists for this email address.",
    });
  }

  return new PolarCustomerError({
    code: polarCustomerErrorCode,
    message: `${message}: ${getUnknownErrorMessage(error)}`,
  });
}

function polarUpdateError(message: string, error: unknown) {
  return new PolarUpdateError({
    code: polarUpdateErrorCode,
    message: `${message}: ${getUnknownErrorMessage(error)}`,
  });
}

/** Live Polar SDK adapter for customer, checkout, and portal operations. */
export const polarGateway: PolarCustomerGateway = {
  createCheckoutSession: (input) =>
    Effect.tryPromise({
      try: () =>
        checkoutsCreate(polarClient, {
          allowDiscountCodes: true,
          customerId: input.customerId,
          customerIpAddress: input.customerIpAddress,
          locale: input.locale,
          products: input.productIds,
          successUrl: input.successUrl,
          embedOrigin: input.embedOrigin,
          subscriptionId: input.subscriptionId,
        }),
      catch: (error) =>
        new PolarCheckoutError({
          code: polarCheckoutErrorCode,
          message: `Failed to create checkout session: ${getUnknownErrorMessage(error)}`,
        }),
    }).pipe(
      Effect.flatMap((result) => {
        if (result.ok) {
          return Effect.succeed({ url: result.value.url });
        }

        return Effect.fail(
          new PolarCheckoutError({
            code: polarCheckoutErrorCode,
            message: `Failed to create checkout session: ${getUnknownErrorMessage(result.error)}`,
          })
        );
      })
    ),

  createCustomer: (input) =>
    Effect.tryPromise({
      try: () =>
        customersCreate(polarClient, {
          externalId: input.externalId,
          email: input.email,
          name: input.name,
          metadata: input.metadata,
        }),
      catch: (error) =>
        polarCustomerError("Failed to create Polar customer", error),
    }).pipe(
      Effect.flatMap((result) => {
        if (result.ok) {
          return Effect.succeed(result.value);
        }

        return Effect.fail(
          polarCustomerError("Failed to create Polar customer", result.error)
        );
      })
    ),

  createCustomerPortalSession: (customerId) =>
    Effect.tryPromise({
      try: () =>
        customerSessionsCreate(polarClient, {
          customerId,
        }),
      catch: (error) =>
        new PolarPortalError({
          code: polarPortalErrorCode,
          message: `Failed to create customer portal session: ${getUnknownErrorMessage(error)}`,
        }),
    }).pipe(
      Effect.flatMap((result) => {
        if (result.ok) {
          return Effect.succeed({ url: result.value.customerPortalUrl });
        }

        return Effect.fail(
          new PolarPortalError({
            code: polarPortalErrorCode,
            message: `Failed to create customer portal session: ${getUnknownErrorMessage(result.error)}`,
          })
        );
      })
    ),

  deleteCustomer: (polarCustomerId) =>
    Effect.tryPromise({
      try: () =>
        customersDelete(polarClient, {
          anonymize: true,
          id: polarCustomerId,
        }),
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) => {
        if (isMissingPolarCustomer(error)) {
          return Effect.succeed(null);
        }

        return Effect.fail(
          new PolarDeleteError({
            code: polarDeleteErrorCode,
            message: `Failed to delete customer from Polar: ${getUnknownErrorMessage(error)}`,
          })
        );
      }),
      Effect.flatMap((result) => {
        if (result === null || result.ok) {
          return Effect.succeed(null);
        }

        if (isMissingPolarCustomer(result.error)) {
          return Effect.succeed(null);
        }

        return Effect.fail(
          new PolarDeleteError({
            code: polarDeleteErrorCode,
            message: `Failed to delete customer from Polar: ${getUnknownErrorMessage(result.error)}`,
          })
        );
      })
    ),

  findCustomerByEmail: (email) =>
    Effect.tryPromise({
      try: () =>
        customersList(polarClient, {
          email,
          limit: 1,
        }),
      catch: (error) =>
        new PolarCustomerError({
          code: polarCustomerErrorCode,
          message: `Failed to find Polar customer by email: ${getUnknownErrorMessage(error)}`,
        }),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.ok) {
          return Effect.fail(
            new PolarCustomerError({
              code: polarCustomerErrorCode,
              message: `Failed to find Polar customer by email: ${getUnknownErrorMessage(result.error)}`,
            })
          );
        }

        return Effect.succeed(result.value.result.items[0] ?? null);
      })
    ),

  getCustomerByExternalId: (externalId) =>
    Effect.tryPromise({
      try: () =>
        customersGetExternal(polarClient, {
          externalId,
        }),
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) => {
        if (isMissingPolarCustomer(error)) {
          return Effect.succeed(null);
        }

        return Effect.fail(
          new PolarCustomerError({
            code: polarCustomerErrorCode,
            message: `Failed to load Polar customer by external ID: ${getUnknownErrorMessage(error)}`,
          })
        );
      }),
      Effect.flatMap((result) => {
        if (result === null) {
          return Effect.succeed(null);
        }

        if (result.ok) {
          return Effect.succeed(result.value);
        }

        if (isMissingPolarCustomer(result.error)) {
          return Effect.succeed(null);
        }

        return Effect.fail(
          new PolarCustomerError({
            code: polarCustomerErrorCode,
            message: `Failed to load Polar customer by external ID: ${getUnknownErrorMessage(result.error)}`,
          })
        );
      })
    ),

  getCustomerById: (polarCustomerId) =>
    Effect.tryPromise({
      try: () =>
        customersGet(polarClient, {
          id: polarCustomerId,
        }),
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) => {
        if (isMissingPolarCustomer(error)) {
          return Effect.succeed(null);
        }

        return Effect.fail(
          new PolarCustomerError({
            code: polarCustomerErrorCode,
            message: `Failed to load Polar customer by ID: ${getUnknownErrorMessage(error)}`,
          })
        );
      }),
      Effect.flatMap((result) => {
        if (result === null) {
          return Effect.succeed(null);
        }

        if (result.ok) {
          return Effect.succeed(result.value);
        }

        if (isMissingPolarCustomer(result.error)) {
          return Effect.succeed(null);
        }

        return Effect.fail(
          new PolarCustomerError({
            code: polarCustomerErrorCode,
            message: `Failed to load Polar customer by ID: ${getUnknownErrorMessage(result.error)}`,
          })
        );
      })
    ),

  updateCustomer: (input) =>
    Effect.tryPromise({
      try: () =>
        customersUpdate(polarClient, {
          id: input.customer.id,
          customerUpdate: {
            email: input.next.email,
            externalId: input.next.externalId,
            metadata: input.next.metadata,
            name: input.next.name,
          },
        }),
      catch: (error) =>
        polarUpdateError("Failed to sync customer data in Polar", error),
    }).pipe(
      Effect.flatMap((result) => {
        if (result.ok) {
          return Effect.succeed(result.value);
        }

        return Effect.fail(
          polarUpdateError(
            "Failed to sync customer data in Polar",
            result.error
          )
        );
      })
    ),

  updateCustomerMetadata: (input) =>
    Effect.tryPromise({
      try: () =>
        customersUpdate(polarClient, {
          id: input.polarCustomerId,
          customerUpdate: {
            metadata: input.metadata,
          },
        }),
      catch: (error) =>
        polarUpdateError("Failed to update customer metadata", error),
    }).pipe(
      Effect.flatMap((result) => {
        if (result.ok) {
          return Effect.succeed(result.value);
        }

        return Effect.fail(
          polarUpdateError("Failed to update customer metadata", result.error)
        );
      })
    ),
};
