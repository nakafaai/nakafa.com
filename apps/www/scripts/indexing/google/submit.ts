import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Effect, MutableList } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";
import { GoogleIndexSubmitError } from "@/scripts/indexing/errors";

const RATE_LIMIT_DELAY = 1000;
const MAX_BACKOFF_DELAY = 30_000;
const BACKOFF_MULTIPLIER = 2;
const LOG_RESPONSE_MAX_LENGTH = 500;

const HTTP_STATUS_CODE_OK = 200;
const HTTP_STATUS_CODE_UNAUTHORIZED = 401;
const HTTP_STATUS_CODE_FORBIDDEN = 403;
const HTTP_STATUS_CODE_TOO_MANY_REQUESTS = 429;

const GOOGLE_PUBLISH_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";

/** Submits eligible URL notifications sequentially for predictable rate stops. */
export const submitUrlsToGoogle = Effect.fn("scripts.google.submit.urls")(
  function* (urls: string[], accessToken: string) {
    if (urls.length === 0) {
      yield* Effect.logInfo(
        "No new eligible URLs to submit to Google Indexing API."
      );
      return [];
    }

    yield* Effect.logInfo(
      `Submitting ${urls.length} Google Indexing API eligible URLs individually...`
    );

    const successfullySubmitted = MutableList.make<string>();
    let currentDelay = RATE_LIMIT_DELAY;

    for (const [index, url] of urls.entries()) {
      const result = yield* submitUrlToGoogle(
        url,
        accessToken,
        index + 1,
        urls.length
      );

      if (result.shouldStop) {
        break;
      }

      if (result.success) {
        MutableList.append(successfullySubmitted, url);
        currentDelay = RATE_LIMIT_DELAY;
      } else {
        currentDelay = Math.min(
          currentDelay * BACKOFF_MULTIPLIER,
          MAX_BACKOFF_DELAY
        );
        yield* Effect.logWarning(
          `Increasing delay to ${currentDelay}ms due to failure.`
        );
      }

      if (index < urls.length - 1) {
        yield* Effect.sleep(currentDelay);
      }
    }

    yield* Effect.logInfo(
      `Google Indexing API submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} eligible URLs.`
    );

    return MutableList.toArray(successfullySubmitted);
  }
);

/** Submits one eligible URL to the Google Indexing API. */
const submitUrlToGoogle = Effect.fn("scripts.google.submit.url")(function* (
  url: string,
  accessToken: string,
  index: number,
  totalUrls: number
) {
  yield* Effect.logInfo(
    `Submitting URL ${index} of ${totalUrls}: ${index}/${totalUrls} (${Math.round((index / totalUrls) * 100)}%)`
  );

  const { responseText, status } = yield* sendSubmitRequest(
    url,
    accessToken
  ).pipe(
    Effect.timeoutOrElse({
      duration: NETWORK_ATTEMPT_DEADLINE,
      orElse: () =>
        Effect.fail(
          new GoogleIndexSubmitError({
            cause: "deadline",
            message: `Submitting ${url} did not answer within 10 seconds.`,
          })
        ),
    })
  );

  if (status === HTTP_STATUS_CODE_OK) {
    yield* Effect.logInfo(`Successfully submitted ${url}`);
    return { shouldStop: false, success: true };
  }

  yield* Effect.logError(`Failed to submit ${url} - Status: ${status}`);
  yield* Effect.logError(
    `Response: ${responseText.slice(0, LOG_RESPONSE_MAX_LENGTH)}...`
  );

  if (status === HTTP_STATUS_CODE_TOO_MANY_REQUESTS) {
    yield* Effect.logError("Rate limit exceeded. Stopping script.");
    return { shouldStop: true, success: false };
  }

  if (
    status === HTTP_STATUS_CODE_UNAUTHORIZED ||
    status === HTTP_STATUS_CODE_FORBIDDEN
  ) {
    yield* Effect.logError(
      "Authentication or permission error. Stopping script."
    );
    return { shouldStop: true, success: false };
  }

  if (
    responseText.toLowerCase().includes("quota") ||
    responseText.toLowerCase().includes("limit exceeded")
  ) {
    yield* Effect.logError("API quota exceeded. Stopping script.");
    return { shouldStop: true, success: false };
  }

  return { shouldStop: false, success: false };
});

/** Sends one eligible URL and reads its acknowledgement. The caller bounds both with one deadline. */
const sendSubmitRequest = Effect.fn("scripts.google.submit.send")(function* (
  url: string,
  accessToken: string
) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* HttpClientRequest.post(GOOGLE_PUBLISH_ENDPOINT).pipe(
    HttpClientRequest.bearerToken(accessToken),
    HttpClientRequest.bodyJsonUnsafe({
      type: "URL_UPDATED",
      url,
    }),
    client.execute,
    Effect.mapError(
      (cause) =>
        new GoogleIndexSubmitError({
          cause,
          message: `Network error submitting ${url}.`,
        })
    )
  );
  // Reading the acknowledgement releases the connection for the next URL.
  const responseText = yield* readSubmitResponse(response, url);
  return { responseText, status: response.status };
});

/** Reads the Indexing API response body for one submitted URL. */
const readSubmitResponse = Effect.fn("scripts.google.submit.readResponse")(
  (response: HttpClientResponse.HttpClientResponse, url: string) =>
    response.text.pipe(
      Effect.mapError(
        (cause) =>
          new GoogleIndexSubmitError({
            cause,
            message: `Failed to read the Indexing API response for ${url}.`,
          })
      )
    )
);
