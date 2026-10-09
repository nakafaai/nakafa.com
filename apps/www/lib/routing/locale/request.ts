import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_ATTEMPT_DEADLINE,
  NETWORK_RETRY_SCHEDULE,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { Data, Effect, Schema } from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientResponse,
} from "effect/http";
import type { Locale } from "next-intl";

/** Raised when the browser language switch cannot resolve a route-owned href. */
class LocalizedHrefRequestError extends Data.TaggedError(
  "LocalizedHrefRequestError"
)<{
  message: string;
}> {}

/**
 * One attempt that a retry may repeat: a missed deadline, or a network failure
 * that Undici classifies as retryable.
 */
class RetryableLocalizedHrefAttempt extends Data.TaggedError(
  "RetryableLocalizedHrefAttempt"
)<{
  readonly failure: LocalizedHrefRequestError;
}> {}

const LocalizedHrefResponseSchema = Schema.Struct({
  href: Schema.String,
});

/** Keeps only the retry classification of a rejected request, never its message. */
function classifyTransportFailure(error: HttpClientError.HttpClientError) {
  const failure = new LocalizedHrefRequestError({ message: String(error) });
  return isRetryableNetworkError(createNetworkRequestError(error.reason.cause))
    ? new RetryableLocalizedHrefAttempt({ failure })
    : failure;
}

/**
 * Sends one localization request and decodes its answer. The deadline covers
 * the send, the status check, and the body read, so a stalled request ends.
 */
const attemptLocalizedHref = Effect.fn("www.routing.locale.attempt")(function* (
  href: string,
  locale: Locale
) {
  const client = yield* HttpClient.HttpClient;
  return yield* client
    .get("/api/internal/routing/locale", {
      acceptJson: true,
      urlParams: { href, locale },
    })
    .pipe(
      Effect.mapError(classifyTransportFailure),
      Effect.flatMap((response) =>
        HttpClientResponse.filterStatusOk(response).pipe(
          Effect.flatMap(
            HttpClientResponse.schemaBodyJson(LocalizedHrefResponseSchema)
          ),
          Effect.mapError(
            (cause) => new LocalizedHrefRequestError({ message: String(cause) })
          )
        )
      ),
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () =>
          Effect.fail(
            new RetryableLocalizedHrefAttempt({
              failure: new LocalizedHrefRequestError({
                message: "The route-localization request timed out.",
              }),
            })
          ),
      })
    );
});

/**
 * Calls the internal route-localization endpoint and decodes the JSON contract
 * before the caller hands it to `router.replace`. A missed deadline or a
 * retryable network failure is tried again on the shared schedule.
 *
 * The browser imports this module when a visitor picks a language, and the
 * module provides its own client, so no page ships the HTTP client in its
 * first JavaScript.
 */
export const requestLocalizedHref = Effect.fn("www.routing.locale.request")(
  function* ({ href, locale }: { href: string; locale: Locale }) {
    return yield* attemptLocalizedHref(href, locale).pipe(
      Effect.retry({
        schedule: NETWORK_RETRY_SCHEDULE,
        while: (error) => error instanceof RetryableLocalizedHrefAttempt,
      }),
      Effect.catchTag("RetryableLocalizedHrefAttempt", ({ failure }) =>
        Effect.fail(failure)
      )
    );
  },
  Effect.provide(FetchClient)
);
