import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  MODEL_MIGRATION_PAGE_BYTES,
  MODEL_MIGRATION_PAGE_ROWS,
  type ModelMigrationCycle,
} from "@repo/backend/convex/contentRelease/models/migration/spec";
import { Effect } from "effect";

/** Detects predecessor read-model progress on one release row. */
function hasModelProgress(
  row: Awaited<ReturnType<typeof readReleasePage>>["page"][number]
) {
  return (
    row.articleCursor !== undefined ||
    row.articleIndex !== undefined ||
    row.articleSyncedAt !== undefined ||
    row.materialCursor !== undefined ||
    row.materialIndex !== undefined ||
    row.materialSyncedAt !== undefined ||
    row.searchIndex !== undefined ||
    row.searchSyncedAt !== undefined ||
    row.syncGeneration !== undefined ||
    row.syncJobId !== undefined
  );
}

/** Reads one bounded release page before terminal progress-field removal. */
function readReleasePage(ctx: MutationCtx, cursor: string | undefined) {
  return ctx.db.query("contentReleases").paginate({
    cursor: cursor ?? null,
    maximumBytesRead: MODEL_MIGRATION_PAGE_BYTES,
    maximumRowsRead: MODEL_MIGRATION_PAGE_ROWS,
    numItems: MODEL_MIGRATION_PAGE_ROWS,
  });
}

/** Removes predecessor read-model progress from one bounded release page. */
export const cleanReleasePage = Effect.fn("contentRelease.cleanModelProgress")(
  function* (ctx: MutationCtx, migration: ModelMigrationCycle) {
    const page = yield* Effect.promise(() =>
      readReleasePage(ctx, migration.cursor)
    );
    for (const row of page.page) {
      if (hasModelProgress(row)) {
        yield* Effect.promise(() =>
          ctx.db.patch("contentReleases", row._id, {
            articleCursor: undefined,
            articleIndex: undefined,
            articleSyncedAt: undefined,
            materialCursor: undefined,
            materialIndex: undefined,
            materialSyncedAt: undefined,
            searchIndex: undefined,
            searchSyncedAt: undefined,
            syncGeneration: undefined,
            syncJobId: undefined,
            updatedAt: Date.now(),
          })
        );
      }
    }
    return page;
  }
);

/** Proves predecessor read-model progress is absent from one release page. */
export const verifyReleasePage = Effect.fn(
  "contentRelease.verifyModelProgress"
)(function* (ctx: MutationCtx, migration: ModelMigrationCycle) {
  const page = yield* Effect.promise(() =>
    readReleasePage(ctx, migration.cursor)
  );
  if (page.page.some(hasModelProgress)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Content releases retained predecessor read-model progress."
    );
  }
  return page;
});
