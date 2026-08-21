import "server-only";
import {
  type BodyLimitError,
  type BodyMissingError,
  type BodyReadError,
  readBoundedBodyResult,
} from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Redacted, Result, Schema } from "effect";
import {
  decodePreviewUrl,
  type PreviewConfig,
  type PreviewConfigError,
} from "@/lib/content/preview/config";
import {
  PreviewBodyLimitError,
  PreviewRequestError,
} from "@/lib/content/preview/errors";

type PreviewJsonError =
  | PreviewBodyLimitError
  | PreviewConfigError
  | PreviewRequestError;
type PreviewJsonResult = Result.Result<unknown, PreviewJsonError>;
/** Maximum UTF-8 bytes accepted from the small current-state manifest. */
export const MAX_PREVIEW_MANIFEST_BYTES = 128 * 1024;
/** Parses an authenticated JSON body without weakening its unknown boundary. */
const decodePreviewJson = Schema.decodeUnknownResult(
  Schema.fromJsonString(Schema.Unknown)
);
/** Validates the exact successful JSON response before reading its body. */
function validateResponse(
  response: Response,
  target: URL
): Result.Result<Response, PreviewRequestError> {
  if (
    response.status !== 200 ||
    response.url !== target.toString() ||
    !isJsonContentType(response.headers.get("content-type"))
  ) {
    return Result.fail(
      new PreviewRequestError({
        stage: "response",
        status: response.status,
      })
    );
  }
  return Result.succeed(response);
}
/** Decodes bounded UTF-8 JSON without starting an Effect runtime. */
function decodeJsonResult(
  bytes: Uint8Array
): Result.Result<unknown, PreviewRequestError> {
  const source = Result.try({
    catch: () => new PreviewRequestError({ stage: "body" }),
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  });
  if (Result.isFailure(source)) {
    return source;
  }
  return Result.mapError(
    decodePreviewJson(source.success),
    () => new PreviewRequestError({ stage: "body" })
  );
}
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
/** Sends one loopback request after a framework-visible Promise suspension. */
function requestPreviewResponse(
  config: PreviewConfig,
  target: URL
): Promise<Result.Result<Response, PreviewRequestError>> {
  return Promise.resolve()
    .then(() =>
      fetch(target, {
        cache: "no-store",
        credentials: "omit",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${Redacted.value(config.token)}`,
        },
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(5000),
      })
    )
    .then(
      (response) => Result.succeed(response),
      () => Result.fail(new PreviewRequestError({ stage: "connect" }))
    );
}
/** Validates and decodes one fetched response without rejecting its Promise. */
function decodeResponseResult(
  result: Result.Result<Response, PreviewRequestError>,
  target: URL,
  maxBytes: number
): Promise<PreviewJsonResult> {
  if (Result.isFailure(result)) {
    return Promise.resolve(Result.fail(result.failure));
  }
  const validated = validateResponse(result.success, target);
  if (Result.isFailure(validated)) {
    return Promise.resolve(Result.fail(validated.failure));
  }
  return readBoundedBodyResult(validated.success.body, maxBytes).then(
    (bytes) => {
      if (Result.isFailure(bytes)) {
        return Result.fail(mapBodyError(bytes.failure));
      }
      return decodeJsonResult(bytes.success);
    }
  );
}
/** Resolves one preview request into a never-rejecting typed result. */
function fetchPreviewJsonResult(
  config: PreviewConfig,
  path: string,
  maxBytes: number
): Promise<PreviewJsonResult> {
  const target = decodePreviewUrl(config, path);
  if (Result.isFailure(target)) {
    return Promise.resolve(Result.fail(target.failure));
  }
  return requestPreviewResponse(config, target.success).then((response) =>
    decodeResponseResult(response, target.success, maxBytes)
  );
}
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
  return fetchPreviewJsonResult(config, path, maxBytes).then((result) => {
    if (Result.isFailure(result)) {
      return Promise.reject(result.failure);
    }
    return result.success;
  });
}
/** Fetches one bearer-protected loopback JSON resource with strict bounds. */
export const fetchPreviewJson = Effect.fn("NakafaContent.fetchPreviewJson")(
  function* (config: PreviewConfig, path: string, maxBytes: number) {
    const result = yield* Effect.promise(() =>
      fetchPreviewJsonResult(config, path, maxBytes)
    );
    if (Result.isFailure(result)) {
      return yield* result.failure;
    }
    return result.success;
  }
);
