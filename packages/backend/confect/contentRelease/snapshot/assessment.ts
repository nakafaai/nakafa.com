import type { AssessmentRecord } from "@nakafa/aksara-contracts/assessment/snapshot";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { assessmentRowFacts } from "@repo/backend/confect/contentRelease/assessment/facts";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Effect } from "effect";

/**
 * Stores one immutable assessment row at its exact signed snapshot index. A
 * retry of the same row is unchanged; any other row at its index or with its
 * identity is a collision.
 */
export const stageAssessmentRow = Effect.fn(
  "contentRelease.stageAssessmentRow"
)(function* (
  snapshotId: string,
  index: number,
  record: AssessmentRecord,
  rowJson: string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const facts = assessmentRowFacts(record.row);
  const stored = {
    ...facts,
    index,
    rowHash: record.rowHash,
    rowJson,
    snapshotId,
  };
  yield* ensureDocumentSize(
    `Assessment snapshot ${snapshotId} row ${index}`,
    stored
  );
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
        facts.kind,
        facts.identity
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
      byIndex.rowJson !== rowJson ||
      byIndex.rowHash !== record.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Assessment snapshot ${snapshotId} has a row identity collision.`
      );
    }
    return true;
  }
  yield* writer.table("assessmentRows").insert(stored).pipe(Effect.orDie);
  return false;
});
