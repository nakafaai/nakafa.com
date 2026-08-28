import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { claimTryoutRuntimeForMigration } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { bundleStageReceiptValidator } from "@repo/backend/convex/tryouts/migration/stage/schema";
import { loadStagingMigration } from "@repo/backend/convex/tryouts/migration/stage/state";
import { storeAuthenticatedTryoutRuntimeBundle } from "@repo/backend/convex/tryouts/runtime/signed";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Stores the active-key bundle that owns every converted target byte. */
export const stageBundleProgram = Effect.fn("tryouts.migration.stageBundle")(
  function* (
    ctx: MutationCtx,
    migrationId: string,
    bundleJson: string,
    rendererJson: string
  ) {
    const now = yield* Clock.currentTimeMillis;
    const migration = yield* loadStagingMigration(ctx, migrationId);
    const bundle = yield* decodeTryoutRuntimeBundleJson(bundleJson);
    const renderer = yield* decodeRendererJson(rendererJson);
    const targetSnapshotId = bundle.payload.snapshot.snapshotId;
    if (
      targetSnapshotId === migration.sourceSnapshotId ||
      (migration.target.kind === "staged" &&
        migration.target.snapshotId !== targetSnapshotId)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out history migration ${migrationId} changed its target bundle.`
      );
    }
    const receipt = yield* storeAuthenticatedTryoutRuntimeBundle(
      ctx,
      bundle,
      renderer,
      now
    );
    if (
      migration.target.kind === "staged" &&
      migration.target.bundleHash !== receipt.bundleHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out history migration ${migrationId} changed its canonical target bundle.`
      );
    }
    yield* claimTryoutRuntimeForMigration(ctx, receipt.bundleHash, migrationId);
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutHistoryMigrations", migration._id, {
        target: {
          bundleCreated:
            migration.target.kind === "staged"
              ? migration.target.bundleCreated
              : receipt.created === 1,
          bundleHash: receipt.bundleHash,
          kind: "staged",
          snapshotCreated:
            migration.target.kind === "staged"
              ? migration.target.snapshotCreated
              : false,
          snapshotId: targetSnapshotId,
        },
        updatedAt: now,
      })
    );
    return {
      bundleHash: receipt.bundleHash,
      created: receipt.created,
      rendererManifestHash: renderer.hash,
      snapshotId: targetSnapshotId,
      unchanged: receipt.unchanged,
    };
  }
);

export const stageBundle = internalMutation({
  args: {
    bundleJson: v.string(),
    migrationId: v.string(),
    rendererJson: v.string(),
  },
  returns: bundleStageReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageBundleProgram(
        ctx,
        args.migrationId,
        args.bundleJson,
        args.rendererJson
      )
    ),
});
