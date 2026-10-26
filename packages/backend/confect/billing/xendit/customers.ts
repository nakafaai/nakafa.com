import {
  XENDIT_ORIGIN,
  XenditRequestFailed,
  xenditRequest,
} from "@repo/backend/confect/billing/xendit/client";
import {
  XenditCustomer,
  XenditCustomerPage,
  XenditCustomerRequest,
} from "@repo/backend/confect/billing/xendit/contract";
import { Array as Arr, Effect, Option } from "effect";
import { HttpClientRequest } from "effect/http";

/** The Customers API version Nakafa names: the one whose customers carry `reference_id`. */
const CUSTOMERS_API_VERSION = "2020-10-31";

/** The customer Xendit holds under one Nakafa reference, or none. */
export const findCustomer = Effect.fn("billing.xendit.findCustomer")(function* (
  referenceId: string
) {
  const page = yield* xenditRequest(
    HttpClientRequest.get(`${XENDIT_ORIGIN}/customers`).pipe(
      HttpClientRequest.setUrlParam("reference_id", referenceId),
      HttpClientRequest.setHeader("api-version", CUSTOMERS_API_VERSION)
    ),
    XenditCustomerPage
  );
  return Arr.head(page.data);
});

/** Creates the customer of one person. */
const createCustomer = Effect.fn("billing.xendit.createCustomer")(function* (
  customer: XenditCustomerRequest
) {
  const request = yield* HttpClientRequest.schemaBodyJson(
    XenditCustomerRequest
  )(
    HttpClientRequest.post(`${XENDIT_ORIGIN}/customers`).pipe(
      HttpClientRequest.setHeader("api-version", CUSTOMERS_API_VERSION)
    ),
    customer
  ).pipe(
    Effect.mapError(
      () =>
        new XenditRequestFailed({
          status: 0,
          errorCode: "REQUEST_NOT_ENCODABLE",
          message: "The customer does not match the Xendit contract.",
        })
    )
  );
  return yield* xenditRequest(request, XenditCustomer);
});

/**
 * The Xendit customer ID of one person: the customer Xendit already holds under
 * the person's reference, or a new one. The lookup comes first, so a checkout that
 * runs again after a lost answer reuses the customer instead of making a second.
 */
export const ensureCustomer = Effect.fn("billing.xendit.ensureCustomer")(
  function* (customer: XenditCustomerRequest) {
    const existing = yield* findCustomer(customer.reference_id);
    if (Option.isSome(existing)) {
      return existing.value.id;
    }
    const created = yield* createCustomer(customer);
    return created.id;
  }
);
