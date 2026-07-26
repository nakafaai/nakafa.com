import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { verifyCurriculum } from "@repo/backend/convex/contentRelease/program/verify";
import { Effect } from "effect";

/** Reads one complete verified curriculum sitemap partition. */
export const readProgramPartition = Effect.fn(
  "contentRelease.readProgramPartition"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof loadProgramOwner>[1],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Program sitemap bucket ${bucket} is invalid.`
    );
  }
  const owner = yield* loadProgramOwner(ctx, locale);
  if (!(owner.managed && owner.selected)) {
    return { kind: "unmanaged" as const };
  }
  const { snapshotId } = owner.selected;
  const count = yield* Effect.promise(() =>
    ctx.db
      .query("programBuckets")
      .withIndex("by_snapshotId_and_locale_and_bucket", (query) =>
        query
          .eq("snapshotId", snapshotId)
          .eq("locale", locale)
          .eq("bucket", bucket)
      )
      .unique()
  );
  if (!count) {
    return { kind: "missing" as const };
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("curriculumRoutes")
      .withIndex("by_snapshotId_and_locale_and_bucket_and_path", (query) =>
        query
          .eq("snapshotId", snapshotId)
          .eq("locale", locale)
          .eq("bucket", bucket)
      )
      .take(CONTENT_BUCKET_SIZE + 1)
  );
  if (
    rows.length !== count.routeCount ||
    rows.length === 0 ||
    rows.length > CONTENT_BUCKET_SIZE
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program sitemap bucket ${locale}/${bucket} has mismatched counts.`
    );
  }
  const routes = yield* Effect.forEach(rows, (row) =>
    verifyCurriculum(row, snapshotId)
  );
  return { kind: "found" as const, routes };
});
