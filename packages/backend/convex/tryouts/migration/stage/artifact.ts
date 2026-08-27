import { MAX_TRYOUT_HISTORY_MIGRATION_ARTIFACTS } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { storeContentArtifact } from "@repo/backend/convex/contentRelease/artifact/store";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { stageMapEntry } from "@repo/backend/convex/tryouts/migration/stage/map";
import {
  type MapInput,
  mapInputValidator,
  simpleStageReceiptValidator,
} from "@repo/backend/convex/tryouts/migration/stage/schema";
import { loadStagingMigration } from "@repo/backend/convex/tryouts/migration/stage/state";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Stores authenticated current artifacts and their source mappings. */
export const stageArtifactsProgram = Effect.fn(
  "tryouts.migration.stageArtifacts"
)(function* (
  ctx: MutationCtx,
  migrationId: string,
  entries: readonly MapInput[]
) {
  if (
    entries.length === 0 ||
    entries.length > MAX_TRYOUT_HISTORY_MIGRATION_ARTIFACTS
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history artifact staging exceeded its bounded batch contract."
    );
  }
  const now = yield* Clock.currentTimeMillis;
  const migration = yield* loadStagingMigration(ctx, migrationId);
  if (migration.target.kind !== "staged") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Try-out history target bundle must be staged before artifacts."
    );
  }
  let created = 0;
  for (const entry of entries) {
    if (entry.kind !== "artifact" || entry.artifactJson === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history artifact staging received an invalid entry."
      );
    }
    const artifact = yield* decodeArtifactJson(entry.artifactJson);
    if (artifact.artifactHash !== entry.newHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history artifact mapping changed its target hash."
      );
    }
    const reused = yield* storeContentArtifact(
      ctx,
      artifact,
      entry.artifactJson,
      now,
      now + ROLLBACK_RETENTION_MS
    );
    if (!(yield* stageMapEntry(ctx, migrationId, entry, !reused))) {
      created += 1;
    }
  }
  if (created > 0) {
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutHistoryMigrations", migration._id, {
        artifactMapCount: migration.artifactMapCount + created,
        updatedAt: now,
      })
    );
  }
  return { created, unchanged: entries.length - created };
});

export const stageArtifacts = internalMutation({
  args: { entries: v.array(mapInputValidator), migrationId: v.string() },
  returns: simpleStageReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageArtifactsProgram(ctx, args.migrationId, args.entries)
    ),
});
