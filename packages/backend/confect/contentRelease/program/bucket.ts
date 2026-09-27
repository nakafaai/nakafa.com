import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/confect/contentRelease/bucket";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Records one sitemap route in its immutable program-snapshot partition. */
export const addProgramBucketRoute = Effect.fn(
  "contentRelease.addProgramBucketRoute"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  appLocale: Doc<"programBuckets">["appLocale"],
  bucket: string
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program sitemap bucket ${bucket} is invalid.`
    );
  }
  const existing = yield* database
    .table("programBuckets")
    .get(
      "by_snapshotId_and_appLocale_and_bucket",
      snapshotId,
      appLocale,
      bucket
    )
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const routeCount = (existing?.routeCount ?? 0) + 1;
  if (routeCount > CONTENT_BUCKET_SIZE) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Program sitemap bucket ${appLocale}/${bucket} exceeds ${CONTENT_BUCKET_SIZE} routes.`
    );
  }
  if (existing) {
    yield* writer
      .table("programBuckets")
      .patch(existing._id, {
        routeCount,
      })
      .pipe(Effect.orDie);
    return;
  }
  yield* writer
    .table("programBuckets")
    .insert({
      appLocale,
      bucket,
      index,
      routeCount,
      snapshotId,
    })
    .pipe(Effect.orDie);
});
