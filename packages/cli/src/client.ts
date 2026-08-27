import { Effect, Schema } from "effect";
import { HttpClient } from "effect/unstable/http";
import {
  ApiResponseError,
  HttpResponseError,
  NetworkError,
  ProblemDetailsSchema,
  ResponseDecodeError,
} from "#cli/error";

interface ApiRequest {
  readonly apiBase: string;
  readonly path: string;
}

/** Calls one public Nakafa endpoint and preserves typed Problem Details. */
export const requestNakafaApi = Effect.fn("NakafaCli.requestApi")(function* (
  request: ApiRequest
) {
  const url = new URL(request.path, `${request.apiBase}/`).href;
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
