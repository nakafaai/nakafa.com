import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadMapping,
  loadTargetRow,
} from "@repo/backend/convex/tryouts/migration/attempt/target";
import { Effect } from "effect";

/** Rebinds frozen section manifests through their lossless catalog mappings. */
export const migrateSections = Effect.fn("tryouts.migration.migrateSections")(
  function* (
    ctx: MutationCtx,
    migrationId: string,
    attempt: Doc<"tryoutAttempts">,
    targetSnapshotId: string
  ) {
    return yield* Effect.forEach(attempt.sectionSnapshots, (section) =>
      Effect.gen(function* () {
        const mapping = yield* loadMapping(
          ctx,
          migrationId,
          "catalog",
          section.sectionRowHash
        );
        const target = yield* loadTargetRow(ctx, targetSnapshotId, mapping);
        if (
          target.rowKind !== "catalog" ||
          target.record.row.kind !== "section" ||
          target.record.row.sectionKey !== section.sectionKey ||
          mapping.identity !== section.sectionIdentity
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Retained section mapping changed its frozen identity."
          );
        }
        return {
          publicPath: target.record.row.publicPath,
          questionCount: target.record.row.questionCount,
          questionSourcePath: target.record.row.questionSourcePath,
          sectionIdentity: mapping.identity,
          sectionKey: target.record.row.sectionKey,
          sectionOrder: target.record.row.order,
          sectionRowHash: target.record.rowHash,
          sourceRevision: target.record.row.sourceRevision,
          timeLimitSeconds: target.record.row.timeLimitSeconds,
        };
      })
    );
  }
);
