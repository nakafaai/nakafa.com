import { Data, Duration, Effect, Schema } from "effect";
import { HttpClient } from "effect/http";
import {
  ApiResponseError,
  HttpResponseError,
  NetworkError,
  ProblemDetailsSchema,
  ResponseDecodeError,
} from "#cli/error";

const ApiRequestSchema = Schema.Struct({
  apiBase: Schema.String,
  path: Schema.String,
});

type ApiRequest = typeof ApiRequestSchema.Type;

/**
 * The longest one request may wait for Nakafa's answer and its body. It is the
 * 10 second attempt budget of the web app's network reads, kept here because
 * this package does not depend on `@repo/backend`.
 */
const REQUEST_DEADLINE = Duration.seconds(10);

/** The request did not finish within its deadline. */
class NakafaRequestDeadline extends Data.TaggedError("NakafaRequestDeadline") {}

/** Sends one GET request and reads its body, so the deadline covers both. */
const sendNakafaRequest = Effect.fn("NakafaCli.sendRequest")(function* (
  url: string
) {
  const response = yield* HttpClient.get(url, {
    accept: "application/json, application/problem+json",
  }).pipe(
    Effect.mapError(
      (cause) =>
        new NetworkError({
          cause,
          message: `Unable to reach ${url}.`,
        })
    )
  );
  const text = yield* response.text.pipe(
    Effect.mapError(
      (cause) =>
        new NetworkError({
          cause,
          message: `Unable to read the response from ${url}.`,
        })
    )
  );
  return { response, text };
});

/** Calls one public Nakafa endpoint and preserves typed Problem Details. */
export const requestNakafaApi = Effect.fn("NakafaCli.requestApi")(function* (
  request: ApiRequest
) {
  const url = new URL(request.path, `${request.apiBase}/`).href;
  const { response, text } = yield* sendNakafaRequest(url).pipe(
    Effect.timeoutOrElse({
      duration: REQUEST_DEADLINE,
      orElse: () =>
        Effect.fail(
          new NetworkError({
            cause: new NakafaRequestDeadline(),
            message: `Nakafa did not answer ${url} within 10 seconds.`,
          })
        ),
    })
  );
  if (
    !(
      isSuccessStatus(response.status) ||
      isJsonMediaType(response.headers["content-type"])
    )
  ) {
    return yield* new HttpResponseError({
      retryAfter: response.headers["retry-after"],
      status: response.status,
    });
  }
  const payload = yield* Schema.decodeEffect(
    Schema.fromJsonString(Schema.Json)
  )(text).pipe(
    Effect.mapError(
      (cause) =>
        new ResponseDecodeError({
          cause,
          message: `Nakafa returned non-JSON data for ${url}.`,
          status: response.status,
        })
    )
  );
  if (isSuccessStatus(response.status)) {
    return payload;
  }
  const problem = yield* Schema.decodeUnknownEffect(ProblemDetailsSchema)(
    payload
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ResponseDecodeError({
          cause,
          message: `Nakafa returned an invalid Problem Details response for ${url}.`,
          status: response.status,
        })
    )
  );
  return yield* new ApiResponseError({
    problem,
    status: response.status,
  });
});

function isSuccessStatus(status: number) {
  return status >= 200 && status < 300;
}

function isJsonMediaType(contentType: string | undefined) {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType?.endsWith("+json");
}
