import type { TryoutSet } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { PublishedCatalog } from "@repo/backend/convex/tryouts/catalog/hierarchy";
import { toPublicPublishedSet } from "@repo/backend/convex/tryouts/catalog/published";
import type { ListArgs } from "@repo/backend/convex/tryouts/sets/spec";
import { Effect, Schema } from "effect";

const SIGNED_CURSOR_PREFIX = "signed:";
const SIGNED_PAGE_LIMIT = 100;

/** One authored set joined with the current user's optional progress. */
export interface PublishedSetRow {
  readonly progress: Doc<"tryoutSetProgress"> | null;
  readonly set: TryoutSet;
}

/** Stable client failure for invalid signed-catalog pagination. */
class PublishedSetPaginationError extends Schema.TaggedError<PublishedSetPaginationError>()(
  "PublishedSetPaginationError",
  {
    code: Schema.Literal(
      "INVALID_TRYOUT_SET_CURSOR",
      "INVALID_TRYOUT_SET_PAGE_SIZE"
    ),
    message: Schema.String,
  }
) {}

/** Paginates one signed list and invalidates cursors when its rows move. */
export const paginatePublishedSets = Effect.fn(
  "tryouts.sets.paginatePublished"
)(function* (
  catalog: PublishedCatalog,
  pagination: ListArgs["paginationOpts"],
  rows: readonly PublishedSetRow[]
) {
  const snapshotId = catalog.snapshotId;
  if (!snapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Signed try-out catalog lost its snapshot identity."
    );
  }
  if (!(Number.isSafeInteger(pagination.numItems) && pagination.numItems > 0)) {
    return yield* new PublishedSetPaginationError({
      code: "INVALID_TRYOUT_SET_PAGE_SIZE",
      message: "The try-out set page size is invalid.",
    });
  }

  const revision = yield* identifyRows(rows);
  const offset = yield* decodeCursor(snapshotId, revision, pagination.cursor);
  const size = Math.min(pagination.numItems, SIGNED_PAGE_LIMIT);
  const end = Math.min(offset + size, rows.length);
  const page = rows.slice(offset, end).map(projectPublishedSet);
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
      JSON.stringify(
        rows.map(({ progress, set }) => ({
          attemptStatus: progress?.status ?? null,
          publishedScore: progress?.publishedScore ?? null,
          setIdentity: tryoutCatalogIdentity(set),
        }))
      )
    )
);

/** Projects one signed set plus optional user progress into the public row. */
function projectPublishedSet({ progress, set }: PublishedSetRow) {
  return {
    ...toPublicPublishedSet(set),
    attemptStatus: progress?.status ?? null,
    publishedScore: progress?.publishedScore ?? null,
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
