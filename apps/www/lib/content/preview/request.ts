import "server-only";
import {
  type BodyLimitError,
  type BodyMissingError,
  type BodyReadError,
  readBoundedBody,
} from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Redacted, Result, Schema } from "effect";
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
  function* (response: Response, target: URL) {
    if (
      response.status !== 200 ||
      response.url !== target.toString() ||
      !isJsonContentType(response.headers.get("content-type"))
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
/** Maps a generic bounded-body failure into the preview error vocabulary. */
function mapBodyError(
  error: BodyLimitError | BodyMissingError | BodyReadError
) {
  if (error._tag === "BodyLimitError") {
    return new PreviewBodyLimitError({
      actualBytes: error.actualBytes,
      maxBytes: error.maxBytes,
    });
  }
  return new PreviewRequestError({ stage: "body" });
}
/** Cancels an unread response body without replacing its primary result. */
function cancelUnreadResponse(response: Response) {
  const body = response.body;
  if (body === null || response.bodyUsed) {
    return Effect.void;
  }
  return Effect.tryPromise({
    catch: () => undefined,
    try: () => body.cancel(),
  }).pipe(Effect.ignore);
}
/** Builds the private request shared by Effect and Next framework boundaries. */
function previewRequestInit(config: PreviewConfig, signal: AbortSignal) {
  return {
    cache: "no-store",
    credentials: "omit",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${Redacted.value(config.token)}`,
    },
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal,
  } satisfies RequestInit;
}
/** Sends one interruptible loopback request with typed connection failure. */
const requestPreviewResponse = Effect.fn(
  "NakafaContent.requestPreviewResponse"
)(function* (config: PreviewConfig, target: URL) {
  return yield* Effect.tryPromise({
    catch: () => new PreviewRequestError({ stage: "connect" }),
    try: (signal) => fetch(target, previewRequestInit(config, signal)),
  });
});
/** Validates and decodes one fetched response through the Effect error channel. */
const decodePreviewResponse = Effect.fn("NakafaContent.decodePreviewResponse")(
  function* (response: Response, target: URL, maxBytes: number) {
    return yield* Effect.acquireUseRelease(
      Effect.succeed(response),
      (activeResponse) =>
        Effect.gen(function* () {
          const validated = yield* validateResponse(activeResponse, target);
          return yield* withPreviewRequestTimeout(
            readBoundedBody(validated.body, maxBytes).pipe(
              Effect.mapError(mapBodyError),
              Effect.flatMap(decodeJson)
            ),
            "body"
          );
        }),
      cancelUnreadResponse
    );
  }
);
/**
 * Fetches one bounded preview resource through Next's direct Promise boundary.
 *
 * Request-less static generation must not start an Effect fiber before its
 * uncached fetch: https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function fetchPreviewJsonForPrerender(
  config: PreviewConfig,
  path: string,
  maxBytes: number
) {
  const target = decodePreviewUrl(config, path);
  if (Result.isFailure(target)) {
    return Promise.reject(target.failure);
  }
  const controller = new AbortController();
  const response = fetch(
    target.success,
    previewRequestInit(config, controller.signal)
  );
  return Effect.runPromise(
    Effect.acquireUseRelease(
      Effect.succeed(controller),
      () =>
        withPreviewRequestTimeout(
          Effect.tryPromise({
            catch: () => new PreviewRequestError({ stage: "connect" }),
            try: () => response,
          }),
          "connect"
        ).pipe(
          Effect.flatMap((value) =>
            decodePreviewResponse(value, target.success, maxBytes)
          )
        ),
      (activeController) => Effect.sync(() => activeController.abort())
    )
  );
}
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
  }
);
