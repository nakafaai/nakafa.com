import "server-only";
import { type BodyLimitError, readBoundedStream } from "@repo/utilities/body";
import { FetchClient } from "@repo/utilities/http/client";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Layer, Result, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";
import {
  decodePreviewUrl,
  type PreviewConfig,
} from "@/lib/content/preview/config";
import {
  PreviewBodyLimitError,
  PreviewRequestError,
} from "@/lib/content/preview/errors";

/** Maximum UTF-8 bytes accepted from the small current-state manifest. */
export const MAX_PREVIEW_MANIFEST_BYTES = 128 * 1024;
const PREVIEW_PHASE_TIMEOUT_MS = 5000;
/**
 * The loopback transport: the Fetch client, kept uncached and free of cookies,
 * redirects, and referrers. Only that client honors these options, so the
 * preview modules provide it themselves instead of accepting any HTTP client.
 */
export const PreviewHttpClient = FetchClient.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    })
  )
);
/** Applies the typed timeout for one preview request phase. */
function withPreviewRequestTimeout<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  stage: "body" | "connect"
) {
  return effect.pipe(
    Effect.timeoutOrElse({
      duration: PREVIEW_PHASE_TIMEOUT_MS,
      orElse: () => Effect.fail(new PreviewRequestError({ stage })),
    })
  );
}
/** Parses authenticated JSON without weakening its unknown boundary. */
const decodePreviewJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Unknown)
);
/** Validates the exact successful JSON response before reading its body. */
const validateResponse = Effect.fn("NakafaContent.validatePreviewResponse")(
  function* (response: HttpClientResponse.HttpClientResponse, target: URL) {
    if (
      response.status !== 200 ||
      response.url !== target.toString() ||
      !isJsonContentType(response.headers["content-type"] ?? null)
    ) {
      return yield* new PreviewRequestError({
        stage: "response",
        status: response.status,
      });
    }
    return response;
  }
);
/** Decodes bounded UTF-8 JSON through typed Effect failures. */
const decodeJson = Effect.fn("NakafaContent.decodePreviewJson")(function* (
  bytes: Uint8Array
) {
  const source = yield* Effect.try({
    catch: () => new PreviewRequestError({ stage: "body" }),
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  });
  return yield* decodePreviewJson(source).pipe(
    Effect.mapError(() => new PreviewRequestError({ stage: "body" }))
  );
});
/** Maps a bounded-body failure into the preview error vocabulary. */
function mapBodyError(error: BodyLimitError | HttpClientError.HttpClientError) {
  if (error._tag === "BodyLimitError") {
    return new PreviewBodyLimitError({
      actualBytes: error.actualBytes,
      maxBytes: error.maxBytes,
    });
  }
  return new PreviewRequestError({ stage: "body" });
}
/** Sends one interruptible loopback request with typed connection failure. */
const requestPreviewResponse = Effect.fn(
  "NakafaContent.requestPreviewResponse"
)(function* (config: PreviewConfig, target: URL) {
  // The scope aborts the request, so a response left unread never lingers.
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  return yield* HttpClientRequest.get(target).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(config.token),
    client.execute,
    Effect.mapError(() => new PreviewRequestError({ stage: "connect" }))
  );
});
/** Validates and decodes one fetched response through the Effect error channel. */
const decodePreviewResponse = Effect.fn("NakafaContent.decodePreviewResponse")(
  function* (
    response: HttpClientResponse.HttpClientResponse,
    target: URL,
    maxBytes: number
  ) {
    const validated = yield* validateResponse(response, target);
    return yield* withPreviewRequestTimeout(
      readBoundedStream(validated.stream, maxBytes).pipe(
        Effect.mapError(mapBodyError),
        Effect.flatMap(decodeJson)
      ),
      "body"
    );
  }
);
/** Fetches one bearer-protected loopback JSON resource with strict bounds. */
export const fetchPreviewJson = Effect.fn("NakafaContent.fetchPreviewJson")(
  function* (config: PreviewConfig, path: string, maxBytes: number) {
    const target = decodePreviewUrl(config, path);
    if (Result.isFailure(target)) {
      return yield* target.failure;
    }
    const response = yield* withPreviewRequestTimeout(
      requestPreviewResponse(config, target.success),
      "connect"
    );
    return yield* decodePreviewResponse(response, target.success, maxBytes);
  },
  Effect.scoped,
  Effect.provide(PreviewHttpClient)
);
/**
 * Fetches one bounded result as a Promise for React `cache` and
 * `generateStaticParams`, which cannot yield an Effect.
 *
 * A render that reads it awaits `io()` first, and Next.js does not track the
 * current time in `generateStaticParams`, so the request may start a fiber:
 * https://nextjs.org/docs/app/api-reference/functions/io
 */
export function fetchPreviewJsonForPrerender(
  config: PreviewConfig,
  path: string,
  maxBytes: number
) {
  return Effect.runPromise(
    fetchPreviewJson(config, path, maxBytes).pipe(Effect.result)
  );
}
