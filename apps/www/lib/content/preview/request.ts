import "server-only";

import { readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Redacted, Schema } from "effect";
import { type PreviewConfig, previewUrl } from "@/lib/content/preview/config";
import {
  PreviewBodyLimitError,
  PreviewRequestError,
} from "@/lib/content/preview/errors";

/** Maximum UTF-8 bytes accepted from the small current-state manifest. */
export const MAX_PREVIEW_MANIFEST_BYTES = 128 * 1024;

/** Parses an authenticated JSON body without weakening its unknown boundary. */
const decodePreviewJson = Schema.decodeUnknown(
  Schema.parseJson(Schema.Unknown)
);

/** Validates the exact successful JSON response before reading its body. */
function validateResponse(response: Response, target: URL) {
  if (
    response.status !== 200 ||
    response.url !== target.toString() ||
    !isJsonContentType(response.headers.get("content-type"))
  ) {
    return Effect.fail(
      new PreviewRequestError({
        stage: "response",
        status: response.status,
      })
    );
  }
  return Effect.succeed(response);
}

/** Fetches one bearer-protected loopback JSON resource with strict bounds. */
export const fetchPreviewJson = Effect.fn("NakafaContent.fetchPreviewJson")(
  function* (config: PreviewConfig, path: string, maxBytes: number) {
    const target = yield* previewUrl(config, path);
    const response = yield* Effect.tryPromise({
      catch: () => new PreviewRequestError({ stage: "connect" }),
      try: () =>
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
        }),
    });
    yield* validateResponse(response, target);
    const bytes = yield* readBoundedBody(response.body, maxBytes).pipe(
      Effect.mapError((error) =>
        error._tag === "BodyLimitError"
          ? new PreviewBodyLimitError({
              actualBytes: error.actualBytes,
              maxBytes: error.maxBytes,
            })
          : new PreviewRequestError({ stage: "body" })
      )
    );
    const source = yield* Effect.try({
      catch: () => new PreviewRequestError({ stage: "body" }),
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    });

    return yield* decodePreviewJson(source).pipe(
      Effect.mapError(() => new PreviewRequestError({ stage: "body" }))
    );
  }
);
