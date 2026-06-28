import { Effect } from "effect";
import { GoogleIndexSubmitError } from "@/scripts/indexing/errors";
import { logger } from "@/scripts/utils";

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
      return yield* Effect.sync(() => {
        logger.info("No new eligible URLs to submit to Google Indexing API.");
        return [];
      });
    }

    logger.info(
      `Submitting ${urls.length} Google Indexing API eligible URLs individually...`
    );

    const successfullySubmitted: string[] = [];
    let shouldStop = false;
    let currentDelay = RATE_LIMIT_DELAY;

    for (const [index, url] of urls.entries()) {
      if (shouldStop) {
        logger.warn(`Stopping at URL ${index + 1} due to API errors.`);
        break;
      }

      const result = yield* submitUrlToGoogle(
        url,
        accessToken,
        index + 1,
        urls.length
      );

      if (result.shouldStop) {
        shouldStop = true;
        break;
      }

      if (result.success) {
        successfullySubmitted.push(url);
        currentDelay = RATE_LIMIT_DELAY;
      } else {
        currentDelay = Math.min(
          currentDelay * BACKOFF_MULTIPLIER,
          MAX_BACKOFF_DELAY
        );
        logger.warn(`Increasing delay to ${currentDelay}ms due to failure.`);
      }

      if (index < urls.length - 1 && !shouldStop) {
        yield* Effect.sleep(currentDelay);
      }
    }

    logger.info(
      `Google Indexing API submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} eligible URLs.`
    );

    return successfullySubmitted;
  }
);

/** Submits one eligible URL to the Google Indexing API. */
const submitUrlToGoogle = Effect.fn("scripts.google.submit.url")(function* (
  url: string,
  accessToken: string,
  index: number,
  totalUrls: number
) {
  logger.progress(index, totalUrls, `Submitting URL ${index} of ${totalUrls}`);

  const { responseText, status } = yield* Effect.tryPromise({
    try: () =>
      fetch(GOOGLE_PUBLISH_ENDPOINT, {
        body: JSON.stringify({
          type: "URL_UPDATED",
          url,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }).then((response) =>
        response.text().then((responseText) => ({
          responseText,
          status: response.status,
        }))
      ),
    catch: (cause) =>
      new GoogleIndexSubmitError({
        cause,
        message: `Network error submitting ${url}.`,
      }),
  });

  if (status === HTTP_STATUS_CODE_OK) {
    logger.info(`Successfully submitted ${url}`);
    return { shouldStop: false, success: true };
  }

  logger.error(`Failed to submit ${url} - Status: ${status}`);
  logger.error(
    `Response: ${responseText.slice(0, LOG_RESPONSE_MAX_LENGTH)}...`
  );

  if (status === HTTP_STATUS_CODE_TOO_MANY_REQUESTS) {
    logger.error("Rate limit exceeded. Stopping script.");
    return { shouldStop: true, success: false };
  }

  if (
    status === HTTP_STATUS_CODE_UNAUTHORIZED ||
    status === HTTP_STATUS_CODE_FORBIDDEN
  ) {
    logger.error("Authentication or permission error. Stopping script.");
    return { shouldStop: true, success: false };
  }

  if (
    responseText.toLowerCase().includes("quota") ||
    responseText.toLowerCase().includes("limit exceeded")
  ) {
    logger.error("API quota exceeded. Stopping script.");
    return { shouldStop: true, success: false };
  }

  return { shouldStop: false, success: false };
});
