/**
 * Google Indexing API Script
 *
 * This script submits URLs to Google's Indexing API in batches to notify Google
 * of new or updated content on the website. It maintains a history of submitted
 * URLs to avoid duplicate submissions and respects Google's API rate limits.
 *
 * Features:
 * - Batch processing (max 100 URLs per batch)
 * - Rate limiting with delays between batches
 * - Submission history tracking in google-index.json
 * - Comprehensive error handling and logging
 * - Automatic URL collection from sitemap
 *
 * Usage:
 *   pnpm run google-index
 *
 * Requirements:
 * - google-key.json file with service account credentials
 * - Service account must have Indexing API permissions
 * - URLs must be from verified Search Console property
 *
 * API Limits:
 * - 200 requests per day per project (default quota)
 * - 100 URLs maximum per batch request
 * - Rate limiting recommended to avoid short-lived API blocks
 */

// Environment variables loaded via Node.js --env-file flag
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Schema } from "effect";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { logger } from "@/scripts/utils";

const RATE_LIMIT_DELAY = 1000; // 1 second between requests
const MAX_BACKOFF_DELAY = 30_000; // 30 seconds maximum backoff
const BACKOFF_MULTIPLIER = 2; // Double the delay on each retry
const PERCENTAGE_MULTIPLIER = 100;
const LOG_RESPONSE_MAX_LENGTH = 500;

const HTTP_STATUS_CODE_OK = 200;
const HTTP_STATUS_CODE_UNAUTHORIZED = 401;
const HTTP_STATUS_CODE_FORBIDDEN = 403;
const HTTP_STATUS_CODE_TOO_MANY_REQUESTS = 429;
const SUCCESS_RATE_THRESHOLD = 50;

// References:
// - https://developers.google.com/search/apis/indexing-api/v3/using-api
// - https://developers.google.com/search/apis/indexing-api/v3/quota-pricing
// - https://developers.google.com/search/apis/indexing-api/v3/prereqs

// Configuration
const host = "https://nakafa.com";

// Local script state folder and file paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_STATE_FOLDER = path.join(__dirname, "state");
const GOOGLE_INDEX_HISTORY_FILE = path.join(
  SCRIPT_STATE_FOLDER,
  "google-index.json"
);
const GOOGLE_KEY_FILE = path.join(__dirname, "google-key.json");

// Google API configuration
const GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_PUBLISH_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWT_AUDIENCE = GOOGLE_TOKEN_ENDPOINT;
const GOOGLE_JWT_ALGORITHM = "RS256";
const GOOGLE_JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const GOOGLE_JWT_TOKEN_LIFETIME_SECONDS = 3600;

const GoogleServiceAccountSchema = Schema.Struct({
  client_email: Schema.NonEmptyTrimmedString,
  private_key: Schema.NonEmptyString,
});
const GoogleTokenResponseSchema = Schema.Struct({
  access_token: Schema.NonEmptyTrimmedString,
});
const GoogleIndexHistorySchema = Schema.Record({
  key: Schema.String,
  value: Schema.String,
});

/** Expected failure while creating the local Google indexing data folder. */
class GoogleIndexDataFolderError extends Schema.TaggedError<GoogleIndexDataFolderError>()(
  "GoogleIndexDataFolderError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while signing the Google service-account JWT assertion. */
class GoogleAssertionSignError extends Schema.TaggedError<GoogleAssertionSignError>()(
  "GoogleAssertionSignError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure returned by Google's OAuth token endpoint. */
class GoogleTokenRequestError extends Schema.TaggedError<GoogleTokenRequestError>()(
  "GoogleTokenRequestError",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
    responseText: Schema.optional(Schema.String),
  }
) {}

/** Expected failure while submitting one URL to Google Indexing. */
class GoogleIndexSubmitError extends Schema.TaggedError<GoogleIndexSubmitError>()(
  "GoogleIndexSubmitError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

const decodeGoogleServiceAccount = Schema.decodeUnknown(
  Schema.parseJson(GoogleServiceAccountSchema)
);
const decodeGoogleTokenResponse = Schema.decodeUnknown(
  Schema.parseJson(GoogleTokenResponseSchema)
);
const decodeGoogleIndexHistory = Schema.decodeUnknown(
  Schema.parseJson(GoogleIndexHistorySchema)
);
const decodeEmptyGoogleIndexHistory = Schema.decodeUnknown(
  GoogleIndexHistorySchema
);

/** Ensures the Google indexing state folder exists before reading history. */
const ensureGoogleIndexDataFolder = Effect.fn(
  "scripts.googleIndex.ensureDataFolder"
)(function* () {
  const exists = yield* Effect.try({
    try: () => fs.existsSync(SCRIPT_STATE_FOLDER),
    catch: (cause) =>
      new GoogleIndexDataFolderError({
        cause,
        message: `Failed to inspect ${SCRIPT_STATE_FOLDER}.`,
      }),
  });

  if (exists) {
    return;
  }

  yield* Effect.try({
    try: () => {
      fs.mkdirSync(SCRIPT_STATE_FOLDER, { recursive: true });
      logger.info(`Created script state folder at: ${SCRIPT_STATE_FOLDER}`);
    },
    catch: (cause) =>
      new GoogleIndexDataFolderError({
        cause,
        message: `Failed to create ${SCRIPT_STATE_FOLDER}.`,
      }),
  });
});

/** Loads and validates the Google service-account credentials used for indexing. */
const loadGoogleServiceAccount = Effect.fn(
  "scripts.googleIndex.loadServiceAccount"
)(function* () {
  const keyFileContent = yield* Effect.try({
    try: () => fs.readFileSync(GOOGLE_KEY_FILE, "utf8"),
    catch: (cause) =>
      new GoogleAssertionSignError({
        cause,
        message: `Failed to read ${GOOGLE_KEY_FILE}.`,
      }),
  });

  return yield* decodeGoogleServiceAccount(keyFileContent).pipe(
    Effect.mapError(
      () =>
        new GoogleAssertionSignError({
          cause: "Invalid google-key.json shape.",
          message:
            "Google service-account credentials must include client_email and private_key.",
        })
    )
  );
});

/** Signs a service-account assertion for Google's OAuth token endpoint. */
const signGoogleAccessTokenAssertion = Effect.fn(
  "scripts.googleIndex.signAssertion"
)(function* () {
  const credentials = yield* loadGoogleServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const key = yield* Effect.tryPromise({
    try: () =>
      webcrypto.subtle.importKey(
        "pkcs8",
        Buffer.from(
          credentials.private_key
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll(/\s/g, ""),
          "base64"
        ),
        {
          hash: "SHA-256",
          name: "RSASSA-PKCS1-v1_5",
        },
        false,
        ["sign"]
      ),
    catch: (cause) =>
      new GoogleAssertionSignError({
        cause,
        message: "Failed to import the Google service-account private key.",
      }),
  });
  const encodedHeader = Buffer.from(
    JSON.stringify({
      alg: GOOGLE_JWT_ALGORITHM,
      typ: "JWT",
    })
  ).toString("base64url");
  const encodedPayload = Buffer.from(
    JSON.stringify({
      aud: GOOGLE_JWT_AUDIENCE,
      exp: now + GOOGLE_JWT_TOKEN_LIFETIME_SECONDS,
      iat: now,
      iss: credentials.client_email,
      scope: GOOGLE_INDEXING_SCOPE,
    })
  ).toString("base64url");
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = yield* Effect.tryPromise({
    try: () =>
      webcrypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        encoder.encode(signatureInput)
      ),
    catch: (cause) =>
      new GoogleAssertionSignError({
        cause,
        message: "Failed to sign the Google service-account JWT assertion.",
      }),
  });

  return `${signatureInput}.${Buffer.from(signature).toString("base64url")}`;
});

/** Exchanges a signed service-account assertion for a Google API access token. */
const getGoogleAccessToken = Effect.fn("scripts.googleIndex.getAccessToken")(
  function* () {
    const assertion = yield* signGoogleAccessTokenAssertion();
    const tokenResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(GOOGLE_TOKEN_ENDPOINT, {
          body: new URLSearchParams({
            assertion,
            grant_type: GOOGLE_JWT_GRANT_TYPE,
          }),
          method: "POST",
        }).then((response) =>
          response.text().then((responseText) => ({
            ok: response.ok,
            responseText,
          }))
        ),
      catch: (cause) =>
        new GoogleTokenRequestError({
          cause,
          message: "Google token request transport failed.",
        }),
    });

    if (!tokenResponse.ok) {
      return yield* Effect.fail(
        new GoogleTokenRequestError({
          message: "Google token request failed.",
          responseText: tokenResponse.responseText,
        })
      );
    }

    return (yield* decodeGoogleTokenResponse(tokenResponse.responseText))
      .access_token;
  }
);

// Load Google indexing history
const loadGoogleIndexHistory = Effect.fn("scripts.googleIndex.loadHistory")(
  function* () {
    const exists = yield* Effect.try({
      try: () => fs.existsSync(GOOGLE_INDEX_HISTORY_FILE),
      catch: (error) => error,
    });

    if (!exists) {
      return yield* decodeEmptyGoogleIndexHistory({});
    }

    const data = yield* Effect.try({
      try: () => fs.readFileSync(GOOGLE_INDEX_HISTORY_FILE, "utf8"),
      catch: (error) => error,
    });

    return yield* decodeGoogleIndexHistory(data);
  }
);

// Save Google indexing history
const saveGoogleIndexHistory = Effect.fn("scripts.googleIndex.saveHistory")(
  function* (history: Record<string, string>) {
    yield* Effect.try({
      try: () => {
        fs.writeFileSync(
          GOOGLE_INDEX_HISTORY_FILE,
          JSON.stringify(history, null, 2),
          "utf8"
        );
      },
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          logger.error(`Error saving Google index history: ${error}`);
        })
      )
    );
  }
);

// Get all URLs from the sitemap that haven't been submitted yet
const getUnsubmittedUrls = Effect.fn("scripts.googleIndex.getUnsubmittedUrls")(
  function* () {
    // Load existing submission history
    const history = yield* loadGoogleIndexHistory().pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            logger.warn(
              `Error loading Google index history: ${error}. Starting with empty history.`
            );
          });
          return yield* decodeEmptyGoogleIndexHistory({});
        })
      )
    );

    const allEntries = yield* getSitemapEntries();

    // Extract unique URLs
    const allUrls = new Set<string>();
    for (const entry of allEntries) {
      allUrls.add(entry.url);
    }

    // Filter out already submitted URLs
    const urls = Array.from(allUrls).filter((url) => !history[url]);

    logger.stats("Total URLs in sitemap", allUrls.size);
    logger.stats(
      "Previously submitted URLs to Google",
      Object.keys(history).length
    );
    logger.stats("New URLs to submit to Google", urls.length);

    return { urls, history };
  }
);

// Update submission history with successfully submitted URLs
function updateGoogleIndexHistory(
  history: Record<string, string>,
  urls: string[]
): Record<string, string> {
  const timestamp = new Date().toISOString();
  for (const url of urls) {
    history[url] = timestamp;
  }
  return history;
}

// Helper function to submit a single URL to Google Indexing API
const submitUrlToGoogle = Effect.fn("scripts.googleIndex.submitUrl")(function* (
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
  }).pipe(
    Effect.catchTag("GoogleIndexSubmitError", (error) =>
      Effect.sync(() => {
        logger.error(`   ${error.message}: ${error.cause}`);
        return {
          responseText: "",
          status: 0,
        };
      })
    )
  );

  if (status === 0) {
    return { shouldStop: false, success: false };
  }

  if (status === HTTP_STATUS_CODE_OK) {
    logger.info(`✅ Successfully submitted ${url}`);
    return { shouldStop: false, success: true };
  }

  logger.error(`❌ Failed to submit ${url} - Status: ${status}`);
  logger.error(
    `   Response: ${responseText.slice(0, LOG_RESPONSE_MAX_LENGTH)}...`
  );

  if (status === HTTP_STATUS_CODE_TOO_MANY_REQUESTS) {
    logger.error("   RATE LIMIT EXCEEDED - Stopping script");
    return { shouldStop: true, success: false };
  }

  if (
    status === HTTP_STATUS_CODE_UNAUTHORIZED ||
    status === HTTP_STATUS_CODE_FORBIDDEN
  ) {
    logger.error("   AUTHENTICATION/PERMISSION ERROR - Stopping script");
    return { shouldStop: true, success: false };
  }

  if (
    responseText.toLowerCase().includes("quota") ||
    responseText.toLowerCase().includes("limit exceeded")
  ) {
    logger.error("   API QUOTA EXCEEDED - Stopping script");
    return { shouldStop: true, success: false };
  }

  return { shouldStop: false, success: false };
});

/**
 * Submits URL notifications sequentially so Google rate-limit failures can
 * stop the script before it burns through the remaining queue.
 */
function submitUrlsToGoogle(
  urls: string[],
  accessToken: string
): Effect.Effect<string[]> {
  if (urls.length === 0) {
    return Effect.sync(() => {
      logger.info("No new URLs to submit to Google Indexing API.");
      return [];
    });
  }

  return Effect.gen(function* () {
    logger.info(
      `Submitting ${urls.length} URLs to Google Indexing API individually...`
    );

    const successfullySubmitted: string[] = [];
    let shouldStop = false;
    let currentDelay = RATE_LIMIT_DELAY;

    for (let index = 0; index < urls.length; index += 1) {
      if (shouldStop) {
        logger.warn(`Stopping at URL ${index + 1} due to API errors.`);
        break;
      }

      const url = urls[index];
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
        logger.info(
          `📈 TOTAL INDEXED SO FAR: ${successfullySubmitted.length} URLs`
        );
        currentDelay = RATE_LIMIT_DELAY;
      } else {
        currentDelay = Math.min(
          currentDelay * BACKOFF_MULTIPLIER,
          MAX_BACKOFF_DELAY
        );
        logger.warn(`⏳ Increasing delay to ${currentDelay}ms due to failure`);
      }

      if (index < urls.length - 1 && !shouldStop) {
        logger.info(`⏱️  Waiting ${currentDelay}ms before next request...`);
        logger.info(`${"═".repeat(60)}`);
        yield* Effect.sleep(currentDelay);
      }
    }

    const finalMessage = shouldStop
      ? `Google Indexing API submission stopped due to errors. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`
      : `Google Indexing API submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`;

    logger.info(finalMessage);

    return successfullySubmitted;
  });
}

// Main function to run the Google indexing process
const runGoogleIndexing = Effect.fn("scripts.googleIndex.run")(function* () {
  yield* Effect.sync(() => {
    logger.header("Starting Google Indexing API Submission Process");
  });
  yield* ensureGoogleIndexDataFolder();

  const accessToken = yield* getGoogleAccessToken().pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          logger.error(`Error in Google indexing process: ${error}`);
          const message = String(error);

          if (
            message.includes("credentials") ||
            message.includes("authentication")
          ) {
            logger.error(
              "Authentication failed. Please check your google-key.json file."
            );
            return;
          }

          if (message.includes("quota") || message.includes("limit")) {
            logger.error(
              "API quota exceeded. Please try again later or contact Google Support to increase your quota."
            );
          }
        });

        return yield* Effect.fail(error);
      })
    )
  );

  logger.stats("Google service account", "Authenticated successfully");
  logger.stats("Website URL", host);
  logger.stats("Rate limit delay", `${RATE_LIMIT_DELAY}ms`);

  const { urls, history } = yield* getUnsubmittedUrls();

  if (urls.length === 0) {
    logger.info(
      "No new URLs to submit to Google Indexing API. All URLs have been previously submitted."
    );
    return;
  }

  const successfullySubmitted = yield* submitUrlsToGoogle(urls, accessToken);

  if (successfullySubmitted.length > 0) {
    const updatedHistory = updateGoogleIndexHistory(
      history,
      successfullySubmitted
    );
    yield* saveGoogleIndexHistory(updatedHistory);

    logger.success(
      `Google Index history updated with ${successfullySubmitted.length} successfully submitted URLs.`
    );
  } else {
    logger.warn("No URLs were successfully submitted to Google Indexing API");
  }

  logger.info("📊 FINAL RESULTS:");
  logger.info(`   📤 Total URLs submitted: ${urls.length}`);
  logger.info(
    `   ✅ URLs actually indexed by Google: ${successfullySubmitted.length}`
  );
  logger.info(
    `   ❌ URLs rejected by Google: ${urls.length - successfullySubmitted.length}`
  );

  const successRate = Math.round(
    (successfullySubmitted.length / urls.length) * PERCENTAGE_MULTIPLIER
  );
  logger.info(`   📈 Success rate: ${successRate}%`);

  if (successRate < SUCCESS_RATE_THRESHOLD) {
    logger.warn("   ⚠️  Low success rate indicates Google rate limiting");
    logger.warn(
      "   💡 This is normal for large batches - Google limits indexing requests"
    );
  }

  if (successfullySubmitted.length > 0) {
    logger.info("✅ URLs have been submitted to Google Indexing API");
    logger.info(
      "📊 Check API usage: Google Cloud Console → APIs & Services → Dashboard → Indexing API"
    );
    logger.info(
      "🔍 Monitor indexing: Google Search Console → Coverage or URL Inspection"
    );
    logger.info(
      "⏰ Note: It may take time for Google to process and index the URLs"
    );
  }

  if (successfullySubmitted.length === 0) {
    logger.error(
      "❌ No URLs were successfully submitted. Check the errors above."
    );
    logger.header("Google Indexing API Submission Process Failed");
    process.exit(1);
  }

  logger.header("Google Indexing API Submission Process Completed");
});

// Run the script
Effect.runPromise(
  runGoogleIndexing().pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        logger.error(`Error running Google indexing script: ${error}`);
        process.exit(1);
      })
    )
  )
);
