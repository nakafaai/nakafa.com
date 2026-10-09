import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_ATTEMPT_DEADLINE,
  NETWORK_RETRY_SCHEDULE,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { Data, Effect } from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientResponse,
} from "effect/http";
import { OpenContentCopyError } from "@/components/shared/content/copy";

/**
 * One attempt that a retry may repeat: a missed deadline, or a network failure
 * that Undici classifies as retryable.
 */
class RetryableSourceAttempt extends Data.TaggedError(
  "RetryableSourceAttempt"
)<{
  readonly failure: OpenContentCopyError;
}> {}

/** Keeps only the retry classification of a rejected request, never its message. */
function classifyTransportFailure(error: HttpClientError.HttpClientError) {
  const failure = new OpenContentCopyError({
    code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
    message: "The reviewed content source could not be fetched.",
  });
  return isRetryableNetworkError(createNetworkRequestError(error.reason.cause))
    ? new RetryableSourceAttempt({ failure })
    : failure;
}

/**
 * Sends one source request, checks its status, and reads its body. The deadline
 * covers all three, so a stalled source ends the request.
 */
const attemptSourceRequest = Effect.fn("www.openContent.attemptSource")(
  function* (copySourceUrl: string) {
    const client = yield* HttpClient.HttpClient;
    return yield* client.get(copySourceUrl).pipe(
      Effect.mapError(classifyTransportFailure),
      Effect.flatMap((response) =>
        HttpClientResponse.filterStatusOk(response).pipe(
          Effect.mapError(
            () =>
              new OpenContentCopyError({
                code: "OPEN_CONTENT_SOURCE_REJECTED",
                message: "The reviewed content source request was rejected.",
              })
          ),
          Effect.flatMap(() =>
            response.text.pipe(
              Effect.mapError(
                () =>
                  new OpenContentCopyError({
                    code: "OPEN_CONTENT_SOURCE_READ_FAILED",
                    message: "The reviewed content source could not be read.",
                  })
              )
            )
          )
        )
      ),
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () =>
          Effect.fail(
            new RetryableSourceAttempt({
              failure: new OpenContentCopyError({
                code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
                message: "The reviewed content source request timed out.",
              }),
            })
          ),
      })
    );
  }
);

/**
 * Fetches one immutable published source. A missed deadline or a retryable
 * network failure is tried again on the shared schedule.
 *
 * The browser imports this module when a reader copies, and the module provides
 * its own client, so no content page ships the HTTP client in its first
 * JavaScript.
 */
export const requestOpenContentSource = Effect.fn(
  "www.openContent.requestSource"
)(function* (copySourceUrl: string) {
  return yield* attemptSourceRequest(copySourceUrl).pipe(
    Effect.retry({
      schedule: NETWORK_RETRY_SCHEDULE,
      while: (error) => error instanceof RetryableSourceAttempt,
    }),
    Effect.catchTag("RetryableSourceAttempt", ({ failure }) =>
      Effect.fail(failure)
    )
  );
}, Effect.provide(FetchClient));
