import { XenditErrorBody } from "@repo/backend/confect/billing/xendit/contract";
import { FetchClient } from "@repo/utilities/http/client";
import { Config, Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/** The Xendit API origin. The sandbox and live keys share it; the key picks the mode. */
export const XENDIT_ORIGIN = "https://api.xendit.co";

/** Xendit answered with a status Nakafa does not expect, or the call never got an answer. */
export class XenditRequestFailed extends Schema.TaggedError<XenditRequestFailed>()(
  "XenditRequestFailed",
  {
    status: Schema.Int,
    errorCode: Schema.String,
    message: Schema.String,
  }
) {}

/** Xendit answered with a body that does not match the documented contract. */
export class XenditDecodeFailed extends Schema.TaggedError<XenditDecodeFailed>()(
  "XenditDecodeFailed",
  {
    message: Schema.String,
  }
) {}

/** The Basic credentials for one call: the secret key as the user name, an empty password. */
const readXenditSecret = Config.Redacted("XENDIT_API_KEY");

/**
 * Sends one authenticated request to Xendit and decodes its 2xx body through
 * `schema`. A non-2xx answer fails as `XenditRequestFailed` with Xendit's own
 * error code, so callers match the failure by tag.
 */
export const xenditRequest = Effect.fn("billing.xendit.request")(function* <
  A,
  I,
>(request: HttpClientRequest.HttpClientRequest, schema: Schema.Codec<A, I>) {
  const secret = yield* readXenditSecret;
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const response = yield* client
    .execute(
      request.pipe(
        HttpClientRequest.basicAuth(Redacted.value(secret), ""),
        HttpClientRequest.acceptJson
      )
    )
    .pipe(
      Effect.mapError(
        () =>
          new XenditRequestFailed({
            status: 0,
            errorCode: "NO_RESPONSE",
            message: "Xendit did not answer.",
          })
      )
    );
  if (response.status < 200 || response.status >= 300) {
    const body = yield* HttpClientResponse.schemaBodyJson(XenditErrorBody)(
      response
    ).pipe(
      Effect.orElseSucceed(() => ({ error_code: "UNREADABLE", message: "" }))
    );
    return yield* new XenditRequestFailed({
      status: response.status,
      errorCode: body.error_code,
      message: body.message,
    });
  }
  return yield* HttpClientResponse.schemaBodyJson(schema)(response).pipe(
    Effect.mapError(
      (error) => new XenditDecodeFailed({ message: String(error) })
    )
  );
}, Effect.provide(FetchClient));
