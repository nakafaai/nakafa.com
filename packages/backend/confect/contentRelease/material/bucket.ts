import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/confect/contentRelease/bucket";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import { Effect } from "effect";

/** Updates one material discovery bucket in the route write transaction. */
export const adjustMaterialBucket = Effect.fn(
  "contentRelease.adjustMaterialBucket"
)(function* (
  slot: ModelSlot,
  appLocale: Docs["materialBuckets"]["appLocale"],
  bucket: string,
  delta: -1 | 1
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material discovery bucket ${bucket} is invalid.`
    );
  }
  const existing = yield* database
    .table("materialBuckets")
    .get("by_slot_and_appLocale_and_bucket", slot, appLocale, bucket)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const count = (existing?.count ?? 0) + delta;
  if (count < 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material discovery bucket ${appLocale}/${bucket} underflowed.`
    );
  }
  if (count > CONTENT_BUCKET_SIZE) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery bucket ${appLocale}/${bucket} exceeds ${CONTENT_BUCKET_SIZE} routes.`
    );
  }
  if (count === 0) {
    const empty = yield* Effect.fromNullishOr(existing).pipe(Effect.orDie);
    yield* writer.table("materialBuckets").delete(empty._id);
    return;
  }
  const row = {
    appLocale,
    bucket,
    count,
    slot,
  };
  if (existing) {
    yield* writer
      .table("materialBuckets")
      .replace(existing._id, row)
      .pipe(Effect.orDie);
    return;
  }
  yield* writer.table("materialBuckets").insert(row).pipe(Effect.orDie);
});
