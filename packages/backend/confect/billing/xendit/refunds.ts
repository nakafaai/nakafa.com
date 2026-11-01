import {
  XENDIT_ORIGIN,
  XenditRequestFailed,
  xenditRequest,
} from "@repo/backend/confect/billing/xendit/client";
import {
  XenditRefund,
  XenditRefundRequest,
} from "@repo/backend/confect/billing/xendit/contract";
import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";

/** The Xendit API version the refund call names. */
const REFUND_API_VERSION = "2024-11-11";

/**
 * Asks Xendit to return one payment. Xendit reports the outcome as a
 * `refund.succeeded` webhook, which settles the payment, never in this answer.
 */
export const createRefund = Effect.fn("billing.xendit.createRefund")(function* (
  body: XenditRefundRequest
) {
  const request = yield* HttpClientRequest.schemaBodyJson(XenditRefundRequest)(
    HttpClientRequest.post(`${XENDIT_ORIGIN}/v3/refunds`).pipe(
      HttpClientRequest.setHeader("api-version", REFUND_API_VERSION)
    ),
    body
  ).pipe(
    Effect.mapError(
      () =>
        new XenditRequestFailed({
          status: 0,
          errorCode: "REQUEST_NOT_ENCODABLE",
          message: "The refund does not match the Xendit contract.",
        })
    )
  );
  return yield* xenditRequest(request, XenditRefund);
});
