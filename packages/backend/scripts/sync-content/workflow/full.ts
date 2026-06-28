import {
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { clean } from "@repo/backend/scripts/sync-content/cleanup/clean";
import {
  formatSyncResult,
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { syncLearningPrograms } from "@repo/backend/scripts/sync-content/content/programs";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { syncGeneratedReadModels } from "@repo/backend/scripts/sync-content/models/sync";
import { syncContentRouteArtifactPages } from "@repo/backend/scripts/sync-content/routes/artifacts";
import { readRoutePageOptionsAfterCleanup } from "@repo/backend/scripts/sync-content/routes/options";
import { invalidateContentRuntimeCache } from "@repo/backend/scripts/sync-content/runtime/cache";
import {
  getCurrentGitCommit,
  saveSyncState,
} from "@repo/backend/scripts/sync-content/runtime/files";
import { verify } from "@repo/backend/scripts/sync-content/verify/sync";
import { syncAll } from "@repo/backend/scripts/sync-content/workflow/run";
import { Effect } from "effect";

/** Runs sync, stale cleanup, verification, cache invalidation, and sync-state save. */
export const syncFull = Effect.fn("sync.full")(function* (
  config: ConvexConfig,
  options: SyncOptions = {}
) {
  log("=== FULL SYNC ===\n");
  log(
    "This command will: sync all content, clean stale content, verify data\n"
  );

  const currentCommit = yield* getCurrentGitCommit();
  const result = yield* Effect.either(
    Effect.gen(function* () {
      yield* syncAll(config, options);
      log("\n");

      const cleanResult = yield* clean(config, {
        ...options,
        authors: true,
        force: true,
      });
      if (cleanResult.hasStale && cleanResult.deleted) {
        log("\nStale content was found and deleted.");
        log("Rebuilding route artifact pages after stale cleanup...");
        const routePageOptions = readRoutePageOptionsAfterCleanup(
          options,
          cleanResult
        );
        const routePageResult = yield* syncContentRouteArtifactPages(
          config,
          routePageOptions
        );
        log(`  Route Pages: ${formatSyncResult(routePageResult)}`);
        const generatedReadModelResult = yield* syncGeneratedReadModels(
          config,
          routePageOptions
        );
        log(
          `  Generated Models: ${formatSyncResult(generatedReadModelResult)}`
        );
        const learningProgramResult = yield* syncLearningPrograms(
          config,
          routePageOptions
        );
        log(`  Learning Programs: ${formatSyncResult(learningProgramResult)}`);
      }

      log("\n");
      yield* verify(config, options);
      yield* invalidateContentRuntimeCache(options);
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
