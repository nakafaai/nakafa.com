import "server-only";

import {
  type BodyLimitError,
  type BodyMissingError,
  type BodyReadError,
  readBoundedBodyResult,
} from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Either, Redacted, Schema } from "effect";
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
type PreviewJsonResult = Either.Either<unknown, PreviewJsonError>;

/** Maximum UTF-8 bytes accepted from the small current-state manifest. */
export const MAX_PREVIEW_MANIFEST_BYTES = 128 * 1024;

/** Parses an authenticated JSON body without weakening its unknown boundary. */
const decodePreviewJson = Schema.decodeUnknownEither(
  Schema.parseJson(Schema.Unknown)
);

/** Validates the exact successful JSON response before reading its body. */
function validateResponse(
  response: Response,
  target: URL
): Either.Either<Response, PreviewRequestError> {
  if (
    response.status !== 200 ||
    response.url !== target.toString() ||
    !isJsonContentType(response.headers.get("content-type"))
  ) {
    return Either.left(
      new PreviewRequestError({
        stage: "response",
        status: response.status,
      })
    );
  }
  return Either.right(response);
}

/** Decodes bounded UTF-8 JSON without starting an Effect runtime. */
function decodeJsonResult(
  bytes: Uint8Array
): Either.Either<unknown, PreviewRequestError> {
  const source = Either.try({
    catch: () => new PreviewRequestError({ stage: "body" }),
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  });
  if (Either.isLeft(source)) {
    return source;
  }

  return Either.mapLeft(
    decodePreviewJson(source.right),
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
): Promise<Either.Either<Response, PreviewRequestError>> {
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
      (response) => Either.right(response),
      () => Either.left(new PreviewRequestError({ stage: "connect" }))
    );
}

/** Validates and decodes one fetched response without rejecting its Promise. */
function decodeResponseResult(
  result: Either.Either<Response, PreviewRequestError>,
  target: URL,
  maxBytes: number
): Promise<PreviewJsonResult> {
  if (Either.isLeft(result)) {
    return Promise.resolve(Either.left(result.left));
  }

  const validated = validateResponse(result.right, target);
  if (Either.isLeft(validated)) {
    return Promise.resolve(Either.left(validated.left));
  }

  return readBoundedBodyResult(validated.right.body, maxBytes).then((bytes) => {
    if (Either.isLeft(bytes)) {
      return Either.left(mapBodyError(bytes.left));
    }
    return decodeJsonResult(bytes.right);
  });
}

/** Resolves one preview request into a never-rejecting typed result. */
function fetchPreviewJsonResult(
  config: PreviewConfig,
  path: string,
  maxBytes: number
): Promise<PreviewJsonResult> {
  const target = decodePreviewUrl(config, path);
  if (Either.isLeft(target)) {
    return Promise.resolve(Either.left(target.left));
  }

  return requestPreviewResponse(config, target.right).then((response) =>
    decodeResponseResult(response, target.right, maxBytes)
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
    if (Either.isLeft(result)) {
      return Promise.reject(result.left);
    }
    return result.right;
  });
}

/** Fetches one bearer-protected loopback JSON resource with strict bounds. */
export const fetchPreviewJson = Effect.fn("NakafaContent.fetchPreviewJson")(
  function* (config: PreviewConfig, path: string, maxBytes: number) {
    const result = yield* Effect.promise(() =>
      fetchPreviewJsonResult(config, path, maxBytes)
    );
    if (Either.isLeft(result)) {
      return yield* result.left;
    }
    return result.right;
  }
);
