import {
  XENDIT_ORIGIN,
  XenditRequestFailed,
  xenditRequest,
} from "@repo/backend/confect/billing/xendit/client";
import {
  XenditSessionRequest,
  XenditSessionResponse,
} from "@repo/backend/confect/billing/xendit/contract";
import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";

/**
 * Opens a hosted checkout and returns its payment link. A session that forces
 * saving the channel also saves it as a payment token for a recurring plan. The
 * outcome arrives by webhook, never in this answer.
 */
export const createSession = Effect.fn("billing.xendit.createSession")(
  function* (body: XenditSessionRequest) {
    const request = yield* HttpClientRequest.schemaBodyJson(
      XenditSessionRequest
    )(HttpClientRequest.post(`${XENDIT_ORIGIN}/sessions`), body).pipe(
      Effect.mapError(
        () =>
          new XenditRequestFailed({
            status: 0,
            errorCode: "REQUEST_NOT_ENCODABLE",
            message: "The session does not match the Xendit contract.",
          })
      )
    );
    return yield* xenditRequest(request, XenditSessionResponse);
  }
);
