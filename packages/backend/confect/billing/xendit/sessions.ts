import {
  XENDIT_ORIGIN,
  xenditRequest,
} from "@repo/backend/confect/billing/xendit/client";
import {
  type XenditSessionRequest,
  XenditSessionResponse,
} from "@repo/backend/confect/billing/xendit/contract";
import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";

/**
 * Opens a hosted checkout. A subscription session returns the recurring plan's
 * ID and a payment link the buyer approves in their wallet; a pay session returns
 * a payment link for one payment. The outcome arrives by webhook, never in this answer.
 */
export const createSession = Effect.fn("billing.xendit.createSession")(
  function* (body: XenditSessionRequest) {
    return yield* xenditRequest(
      HttpClientRequest.post(`${XENDIT_ORIGIN}/sessions`).pipe(
        HttpClientRequest.bodyJsonUnsafe(body)
      ),
      XenditSessionResponse
    );
  }
);
