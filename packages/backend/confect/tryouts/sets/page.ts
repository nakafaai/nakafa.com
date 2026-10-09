import { TryoutSetSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import tryoutSetProgress from "@repo/backend/confect/_generated/tables/tryoutSetProgress";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import type { ListArgs } from "@repo/backend/confect/tryouts/sets/spec";
import {
  PublishedSetPaginationError,
  runningAttemptValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import type { PublishedCatalog } from "@repo/backend/content/tryout/hierarchy";
import { toPublicPublishedSet } from "@repo/backend/content/tryout/published";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Schema } from "effect";

const SIGNED_CURSOR_PREFIX = "signed:";
const publishedSetRowSchema = Schema.Struct({
  durationSeconds: Schema.Finite,
  progress: Schema.NullOr(tryoutSetProgress.Doc),
  runningAttempt: Schema.NullOr(runningAttemptValidator),
  set: TryoutSetSchema,
});
/** One authored set joined with the current user's optional progress. */
export type PublishedSetRow = typeof publishedSetRowSchema.Type;
/** Stable client failure for invalid signed-catalog pagination. */

/** Paginates one signed list and invalidates cursors when its rows move. */
export const paginatePublishedSets = Effect.fn(
  "tryouts.sets.paginatePublished"
)(function* (
  catalog: PublishedCatalog,
  pagination: ListArgs["paginationOpts"],
  rows: readonly PublishedSetRow[]
) {
  const snapshotId = catalog.snapshotId;
  if (!(Number.isSafeInteger(pagination.numItems) && pagination.numItems > 0)) {
    return yield* new PublishedSetPaginationError({
      code: "INVALID_TRYOUT_SET_PAGE_SIZE",
      message: "The try-out set page size is invalid.",
    });
  }
  const revision = yield* identifyRows(rows);
  const offset = yield* decodeCursor(snapshotId, revision, pagination.cursor);
  // A growing first-page subscription never exceeds the verified whole-catalog ceiling.
  const size = Math.min(pagination.numItems, TRYOUT_CATALOG_LIMIT);
  const end = Math.min(offset + size, rows.length);
  const page = Arr.map(rows.slice(offset, end), projectPublishedSet);
  const isDone = end >= rows.length;
  return {
    continueCursor: isDone ? "" : encodeCursor(snapshotId, revision, end),
    isDone,
    page,
  };
});
/** Identifies the exact ordered rows visible to one pagination request. */
const identifyRows = Effect.fn("tryouts.sets.identifyPublishedPage")(
  (rows: readonly PublishedSetRow[]) =>
    hashText(
      "the signed try-out pagination state",
      encodeJsonText(
        Arr.map(rows, ({ progress, set }) => ({
          attemptStatus: progress?.status ?? null,
          publishedScore: progress?.publishedScore ?? null,
          setIdentity: tryoutCatalogIdentity(set),
        }))
      )
    )
);
/** Projects one signed set plus optional user progress into the public row. */
function projectPublishedSet({
  durationSeconds,
  progress,
  runningAttempt,
  set,
}: PublishedSetRow) {
  return {
    ...toPublicPublishedSet(set),
    attemptStatus: progress?.status ?? null,
    durationSeconds,
    publishedScore: progress?.publishedScore ?? null,
    runningAttempt,
  };
}
/** Encodes an offset under its immutable catalog and mutable row revision. */
function encodeCursor(snapshotId: string, revision: string, offset: number) {
  return `${SIGNED_CURSOR_PREFIX}${snapshotId}:${revision}:${offset}`;
}
/** Decodes one exact-state cursor or asks the client to restart pagination. */
function decodeCursor(
  snapshotId: string,
  revision: string,
  cursor: string | null
) {
  if (cursor === null) {
    return Effect.succeed(0);
  }
  const prefix = `${SIGNED_CURSOR_PREFIX}${snapshotId}:${revision}:`;
  if (!cursor.startsWith(prefix)) {
    return cursorFailure();
  }
  const value = Number(cursor.slice(prefix.length));
  if (!(Number.isSafeInteger(value) && value >= 0)) {
    return cursorFailure();
  }
  return Effect.succeed(value);
}
/** Creates the cursor signal recognized by Convex's paginated React hook. */
function cursorFailure() {
  return new PublishedSetPaginationError({
    code: "INVALID_TRYOUT_SET_CURSOR",
    message: "InvalidCursor: The try-out set pagination state changed.",
  });
}
