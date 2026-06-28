import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import {
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/cli/logging";
import type { SyncOptions } from "@repo/backend/scripts/sync-content/contract/types";
import { Config, Effect, Schema } from "effect";

const CONTENT_RUNTIME_CACHE_REVALIDATE_PATH = "/api/internal/content/cache";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

class ContentRuntimeCacheConfigError extends Schema.TaggedError<ContentRuntimeCacheConfigError>()(
  "ContentRuntimeCacheConfigError",
  {
    message: Schema.String,
  }
) {}

class ContentRuntimeCacheInvalidationError extends Schema.TaggedError<ContentRuntimeCacheInvalidationError>()(
  "ContentRuntimeCacheInvalidationError",
  {
    message: Schema.String,
  }
) {}

/**
 * Builds the protected Next.js cache invalidation endpoint from one site URL.
 */
export function getContentRuntimeCacheRevalidationUrl(siteUrl: string) {
  if (!URL.canParse(CONTENT_RUNTIME_CACHE_REVALIDATE_PATH, siteUrl)) {
    return;
  }

  return new URL(CONTENT_RUNTIME_CACHE_REVALIDATE_PATH, siteUrl).toString();
}

/**
 * Returns whether a failed invalidation targets a local development server.
 */
function canSkipUnavailableLocalApp(siteUrl: string, options: SyncOptions) {
  if (options.prod) {
    return false;
  }

  const hostname = new URL(siteUrl).hostname;

  return LOCAL_HOSTNAMES.has(hostname);
}

/**
 * Reads one required sync-cache config value.
 */
function readConfigValue(name: string, message: string) {
  return Config.nonEmptyString(name).pipe(
    Effect.mapError(() => new ContentRuntimeCacheConfigError({ message }))
  );
}

/**
 * Invalidates Next.js content runtime cache after the Convex read model is synced.
 */
export const invalidateContentRuntimeCache = Effect.fn(
  "sync.invalidateContentRuntimeCache"
)(function* (options: SyncOptions) {
  const siteUrl = yield* readConfigValue(
    "SITE_URL",
    "SITE_URL is required to invalidate the content runtime cache."
  );
  const internalKey = yield* readConfigValue(
    "INTERNAL_CONTENT_API_KEY",
    "INTERNAL_CONTENT_API_KEY is required to invalidate the content runtime cache."
  );
  const endpoint = getContentRuntimeCacheRevalidationUrl(siteUrl);

  if (!endpoint) {
    return yield* Effect.fail(
      new ContentRuntimeCacheConfigError({
        message: `SITE_URL must be a valid URL: ${siteUrl}`,
      })
    );
  }

  const response = yield* Effect.either(
    Effect.tryPromise({
      try: () =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${internalKey}`,
            "Content-Type": "application/json",
          },
        }),
      catch: (error) =>
        new ContentRuntimeCacheInvalidationError({
          message: getUnknownMessage(error),
        }),
    })
  );

  if (response._tag === "Left") {
    if (canSkipUnavailableLocalApp(siteUrl, options)) {
      logWarning(
        `Skipped local content runtime cache invalidation because ${endpoint} is unavailable.`
      );
      return;
    }

    return yield* Effect.fail(response.left);
  }

  if (response.right.ok) {
    logSuccess("Content runtime cache invalidated");
    return;
  }

  const body = yield* Effect.either(
    Effect.tryPromise({
      try: () => response.right.text(),
      catch: (error) =>
        new ContentRuntimeCacheInvalidationError({
          message: getUnknownMessage(error),
        }),
    })
  );
  const responseBody = body._tag === "Right" ? body.right : "";

  return yield* Effect.fail(
    new ContentRuntimeCacheInvalidationError({
      message: `Content runtime cache invalidation failed with ${response.right.status}: ${responseBody}`,
    })
  );
});
