import { FetchClient } from "@repo/utilities/http/client";
import { Effect } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { OpenContentCopyError } from "@/components/shared/content/copy";

/**
 * Fetches one immutable published source.
 *
 * The browser imports this module when a reader copies, and the module
 * provides its own client, so no content page ships the HTTP client in its
 * first JavaScript.
 */
export const requestOpenContentSource = Effect.fn(
  "www.openContent.requestSource"
)(function* (copySourceUrl: string) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get(copySourceUrl).pipe(
    Effect.mapError(
      () =>
        new OpenContentCopyError({
          code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
          message: "The reviewed content source could not be fetched.",
        })
    )
  );
  yield* HttpClientResponse.filterStatusOk(response).pipe(
    Effect.mapError(
      () =>
        new OpenContentCopyError({
          code: "OPEN_CONTENT_SOURCE_REJECTED",
          message: "The reviewed content source request was rejected.",
        })
    )
  );
  return yield* response.text.pipe(
    Effect.mapError(
      () =>
        new OpenContentCopyError({
          code: "OPEN_CONTENT_SOURCE_READ_FAILED",
          message: "The reviewed content source could not be read.",
        })
    )
  );
}, Effect.provide(FetchClient));
