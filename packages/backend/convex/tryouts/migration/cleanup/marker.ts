import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  retainedScaleRepair,
  type ScaleRepairEvidence,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { Effect } from "effect";

/** Observes the independent exact scale whose absence proves repair ran. */
export const retainedRepairScalePresent = Effect.fn(
  "tryouts.migration.retainedRepairScalePresent"
)(function* (
  ctx: QueryCtx,
  migrationId: string,
  evidence: ScaleRepairEvidence = retainedScaleRepair
) {
  if (migrationId !== evidence.migrationId) {
    return false;
  }
  const scales = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleVersions")
      .withIndex(
        "by_tryoutSnapshotId_and_setIdentity_and_publishedAt",
        (query) =>
          query
            .eq("tryoutSnapshotId", evidence.sourceSnapshotId)
            .eq("setIdentity", evidence.setIdentity)
            .eq("publishedAt", evidence.publishedAt)
      )
      .take(2)
  );
  if (
    scales.length > 1 ||
    (scales[0] !== undefined && scales[0]._id !== evidence.scaleVersionId)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration changed its retained repair scale identity."
    );
  }
  return scales.length === 1;
});
