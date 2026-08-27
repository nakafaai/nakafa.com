import { Effect, Schema } from "effect";
import {
  ApiResponseError,
  HttpResponseError,
  NetworkError,
  ProblemDetailsSchema,
  ResponseDecodeError,
} from "#cli/error";

export type FetchImplementation = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

interface ApiRequest {
  readonly apiBase: string;
  readonly fetchImplementation: FetchImplementation;
  readonly path: string;
}

/** Calls one public Nakafa endpoint and preserves typed Problem Details. */
export const requestNakafaApi = Effect.fn("NakafaCli.requestApi")(function* (
  request: ApiRequest
) {
  const url = new URL(request.path, `${request.apiBase}/`).href;
  const headers = new Headers({
    Accept: "application/json, application/problem+json",
  });
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new NetworkError({
        cause,
        message: `Unable to reach ${url}.`,
      }),
    try: () =>
      request.fetchImplementation(url, {
        headers,
        method: "GET",
      }),
  });
  const text = yield* Effect.tryPromise({
    catch: (cause) =>
      new NetworkError({
        cause,
        message: `Unable to read the response from ${url}.`,
      }),
    try: () => response.text(),
  });
  if (!(response.ok || isJsonMediaType(response.headers.get("content-type")))) {
    return yield* new HttpResponseError({
      retryAfter: response.headers.get("retry-after") ?? undefined,
      status: response.status,
    });
  }
  const payload = yield* Effect.try({
    catch: (cause) =>
      new ResponseDecodeError({
        cause,
        message: `Nakafa returned non-JSON data for ${url}.`,
        status: response.status,
      }),
    try: () => JSON.parse(text),
  });
  if (response.ok) {
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

function isJsonMediaType(contentType: string | null) {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType?.endsWith("+json");
}
