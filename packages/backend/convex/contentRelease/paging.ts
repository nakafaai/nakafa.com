import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

/** Maximum projection rows requested through one public discovery page. */
export const PROJECTION_PAGE_LIMIT = 32;

/** Maximum optional read budget accepted from one discovery caller. */
export const PROJECTION_PAGE_BYTES = 4 * 1024 * 1024;

/** Rejects pagination inputs that exceed the public discovery budget. */
export const validateProjectionPage = Effect.fn(
  "contentRelease.validateProjectionPage"
)(function* (options: PaginationOptions) {
  if (
    !Number.isSafeInteger(options.numItems) ||
    options.numItems < 1 ||
    options.numItems > PROJECTION_PAGE_LIMIT
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Projection pages accept 1 to ${PROJECTION_PAGE_LIMIT} rows.`
    );
  }
  if (
    options.maximumRowsRead !== undefined &&
    (!Number.isSafeInteger(options.maximumRowsRead) ||
      options.maximumRowsRead < options.numItems ||
      options.maximumRowsRead > PROJECTION_PAGE_LIMIT)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Projection pages accept at most ${PROJECTION_PAGE_LIMIT} scanned rows.`
    );
  }
  if (
    options.maximumBytesRead !== undefined &&
    (!Number.isSafeInteger(options.maximumBytesRead) ||
      options.maximumBytesRead < 1 ||
      options.maximumBytesRead > PROJECTION_PAGE_BYTES)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Projection pages accept at most ${PROJECTION_PAGE_BYTES} read bytes.`
    );
  }
  return {
    ...options,
    maximumBytesRead: options.maximumBytesRead ?? PROJECTION_PAGE_BYTES,
    maximumRowsRead: options.maximumRowsRead ?? PROJECTION_PAGE_LIMIT,
  };
});
