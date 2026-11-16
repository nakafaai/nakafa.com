import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { AssessmentDocumentSchema } from "@repo/backend/confect/contentRelease/snapshot/shape";
import { Effect } from "effect";

/**
 * Stores one prepared immutable assessment row at its exact signed snapshot
 * index. A retry of the same row is unchanged; any other row at its index or
 * with its identity is a collision.
 */
export const stageAssessmentRow = Effect.fn(
  "contentRelease.stageAssessmentRow"
)(function* (
  snapshotId: string,
  index: number,
  document: typeof AssessmentDocumentSchema.Type
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const [byIndex, byIdentity] = yield* Effect.all([
    database
      .table("assessmentRows")
      .get("by_snapshotId_and_index", snapshotId, index)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      ),
    database
      .table("assessmentRows")
      .get(
        "by_snapshotId_and_kind_and_identity",
        snapshotId,
        document.kind,
        document.identity
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      ),
  ]);
  if (byIndex || byIdentity) {
    if (
      !(byIndex && byIdentity) ||
      byIndex._id !== byIdentity._id ||
      byIndex.rowJson !== document.rowJson ||
      byIndex.rowHash !== document.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Assessment snapshot ${snapshotId} has a row identity collision.`
      );
    }
    return true;
  }
  yield* writer
    .table("assessmentRows")
    .insert({ ...document, index, snapshotId })
    .pipe(Effect.orDie);
  return false;
});
