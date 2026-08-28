import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotJson } from "@repo/backend/convex/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { snapshotStageReceiptValidator } from "@repo/backend/convex/tryouts/migration/stage/schema";
import { loadStagingMigration } from "@repo/backend/convex/tryouts/migration/stage/state";
import type { WithoutSystemFields } from "convex/server";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Stores the current snapshot manifest after every target row is staged. */
export const stageSnapshotProgram = Effect.fn(
  "tryouts.migration.stageSnapshot"
)(function* (ctx: MutationCtx, migrationId: string, snapshotJson: string) {
  const now = yield* Clock.currentTimeMillis;
  const migration = yield* loadStagingMigration(ctx, migrationId);
  const snapshot = yield* decodeSnapshotJson(snapshotJson);
  if (
    snapshot.family !== "tryout" ||
    migration.target.kind !== "staged" ||
    migration.target.snapshotId !== snapshot.manifest.snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history snapshot differs from its staged bundle."
    );
  }
  const target = migration.target;
  const existing = yield* loadSnapshot(
    ctx,
    "tryout",
    snapshot.manifest.snapshotId
  );
  if (existing) {
    if (existing.snapshotJson !== snapshotJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Try-out history target snapshot was reused with different bytes."
      );
    }
    return {
      created: 0,
      snapshotId: snapshot.manifest.snapshotId,
      unchanged: 1,
    };
  }
  const row = {
    createdAt: now,
    family: "tryout",
    retainUntil: now + ROLLBACK_RETENTION_MS,
    snapshotId: snapshot.manifest.snapshotId,
    snapshotJson,
  } satisfies WithoutSystemFields<Doc<"contentSnapshots">>;
  yield* ensureDocumentSize(
    `Content snapshot tryout/${snapshot.manifest.snapshotId}`,
    row
  );
  yield* Effect.promise(() => ctx.db.insert("contentSnapshots", row));
  yield* Effect.promise(() =>
    ctx.db.patch("tryoutHistoryMigrations", migration._id, {
      target: { ...target, snapshotCreated: true },
      updatedAt: now,
    })
  );
  return {
    created: 1,
    snapshotId: snapshot.manifest.snapshotId,
    unchanged: 0,
  };
});

export const stageSnapshot = internalMutation({
  args: { migrationId: v.string(), snapshotJson: v.string() },
  returns: snapshotStageReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageSnapshotProgram(ctx, args.migrationId, args.snapshotJson)
    ),
});
