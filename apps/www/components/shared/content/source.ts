import {
  classifyNetworkFailure,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { OpenContentCopyError } from "@/components/shared/content/copy";

/**
 * Sends one source request, checks its status, and reads its body. The retry
 * helper gives the attempt its deadline, which covers all three, so a stalled
 * source ends the request.
 */
const attemptSourceRequest = Effect.fn("www.openContent.attemptSource")(
  function* (copySourceUrl: string) {
    const client = yield* HttpClient.HttpClient;
    return yield* client.get(copySourceUrl).pipe(
      // The rejected request keeps its retry class, never its message.
      Effect.mapError((error) =>
        classifyNetworkFailure(
          error.reason.cause,
          OpenContentCopyError.make({
            code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
            message: "The reviewed content source could not be fetched.",
          })
        )
      ),
      Effect.flatMap((response) =>
        HttpClientResponse.filterStatusOk(response).pipe(
          Effect.mapError(() =>
            OpenContentCopyError.make({
              code: "OPEN_CONTENT_SOURCE_REJECTED",
              message: "The reviewed content source request was rejected.",
            })
          ),
          Effect.flatMap(() =>
            response.text.pipe(
              Effect.mapError(() =>
                OpenContentCopyError.make({
                  code: "OPEN_CONTENT_SOURCE_READ_FAILED",
                  message: "The reviewed content source could not be read.",
                })
              )
            )
          )
        )
      )
    );
  }
);

/**
 * Fetches one immutable published source. A missed deadline or a retryable
 * network failure is tried again on the shared schedule. The retry budget is
 * 31.5 seconds, and the copy path in `copy.ts` cuts the whole read at 10
 * seconds.
 *
 * The browser imports this module when a reader copies, and the module provides
 * its own client, so no content page ships the HTTP client in its first
 * JavaScript.
 */
export const requestOpenContentSource = Effect.fn(
  "www.openContent.requestSource"
)(function* (copySourceUrl: string) {
  return yield* retryNetworkAttempt(
    attemptSourceRequest(copySourceUrl),
    OpenContentCopyError.make({
      code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
      message: "The reviewed content source request timed out.",
    })
  );
}, Effect.provide(FetchClient));
