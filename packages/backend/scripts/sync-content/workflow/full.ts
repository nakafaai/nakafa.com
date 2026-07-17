import {
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { clean } from "@repo/backend/scripts/sync-content/cleanup/clean";
import {
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { readRoutePageOptionsAfterCleanup } from "@repo/backend/scripts/sync-content/routes/options";
import { invalidateContentRuntimeCache } from "@repo/backend/scripts/sync-content/runtime/cache";
import {
  getCurrentGitCommit,
  saveSyncState,
} from "@repo/backend/scripts/sync-content/runtime/files";
import { verify } from "@repo/backend/scripts/sync-content/verify/sync";
import { syncAll } from "@repo/backend/scripts/sync-content/workflow/run";
import { Effect } from "effect";

/** Runs stale cleanup, sync, verification, cache invalidation, and state save. */
export const syncFull = Effect.fn("sync.full")(function* (
  config: ConvexConfig,
  options: SyncOptions = {}
) {
  log("=== FULL SYNC ===\n");
  log(
    "This command will: clean stale content, sync all content, verify data\n"
  );

  const currentCommit = yield* getCurrentGitCommit();
  const result = yield* Effect.either(
    Effect.gen(function* () {
      const cleanResult = yield* clean(config, {
        ...options,
        authors: true,
        force: true,
      });
      const syncOptions = readRoutePageOptionsAfterCleanup(
        options,
        cleanResult
      );

      if (cleanResult.deleted > 0) {
        log("\nStale content was found and deleted.");
      }

      log("\n");
      yield* syncAll(config, syncOptions);
      log("\n");
      yield* verify(config, syncOptions);
      yield* invalidateContentRuntimeCache(syncOptions);
      yield* saveSyncState(
        { lastSyncCommit: currentCommit, lastSyncTimestamp: Date.now() },
        options.prod ?? false
      );
    })
  );

  if (result._tag === "Left") {
    logError(`Full sync failed: ${getUnknownMessage(result.left)}`);
    return yield* Effect.fail(
      new ScriptFailureError({ message: "Full sync failed." })
    );
  }

  log("\n=== FULL SYNC COMPLETE ===");
  logSuccess("All operations completed successfully!");
  logSuccess("Sync state saved for incremental syncs");
});
