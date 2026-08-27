import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadTryoutHistoryMigration } from "@repo/backend/convex/tryouts/migration/state/store";
import { Effect } from "effect";

/** Requires invisible staging before any target bytes can change. */
export const loadStagingMigration = Effect.fn(
  "tryouts.migration.loadStagingMigration"
)(function* (ctx: MutationCtx, migrationId: string) {
  const migration = yield* loadTryoutHistoryMigration(ctx, migrationId);
  if (migration.phase !== "staging") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Try-out history migration ${migrationId} no longer accepts staging.`
    );
  }
  return migration;
});
