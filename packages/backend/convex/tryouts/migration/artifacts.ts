import { MAX_TRYOUT_HISTORY_MIGRATION_ROWS } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

export const targetArtifactValidator = v.object({
  artifactHash: v.string(),
  artifactJson: v.string(),
  oldHash: v.string(),
});

/** Loads target artifacts only through this migration's exact source mappings. */
const readTargetArtifactBatch = Effect.fn(
  "tryouts.migration.readTargetArtifactBatch"
)(function* (ctx: QueryCtx, migrationId: string, oldHashes: readonly string[]) {
  if (
    oldHashes.length > MAX_TRYOUT_HISTORY_MIGRATION_ROWS * 2 ||
    new Set(oldHashes).size !== oldHashes.length
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted artifact lookup is not a bounded unique batch."
    );
  }
  return yield* Effect.forEach(oldHashes, (oldHash) =>
    Effect.gen(function* () {
      const mapping = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutHistoryMigrationMaps")
          .withIndex("by_migrationId_and_kind_and_oldHash", (query) =>
            query
              .eq("migrationId", migrationId)
              .eq("kind", "artifact")
              .eq("oldHash", oldHash)
          )
          .unique()
      );
      if (!mapping) {
        return yield* releaseFail(
          "CONTENT_RELEASE_MISSING",
          "Converted placement lost an artifact mapping."
        );
      }
      const artifact = yield* Effect.promise(() =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (query) =>
            query.eq("artifactHash", mapping.newHash)
          )
          .unique()
      );
      if (!artifact || artifact.artifactHash !== mapping.newHash) {
        return yield* releaseFail(
          "CONTENT_RELEASE_MISSING",
          "Converted placement lost its permanent artifact."
        );
      }
      return {
        artifactHash: artifact.artifactHash,
        artifactJson: artifact.artifactJson,
        oldHash,
      };
    })
  );
});

export const targetArtifactBatch = internalQuery({
  args: { migrationId: v.string(), oldHashes: v.array(v.string()) },
  returns: v.array(targetArtifactValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      readTargetArtifactBatch(ctx, args.migrationId, args.oldHashes)
    ),
});
