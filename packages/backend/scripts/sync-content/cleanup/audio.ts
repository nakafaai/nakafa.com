import { internal } from "@repo/backend/convex/_generated/api";
import {
  formatDuration,
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { getContentCounts } from "@repo/backend/scripts/sync-content/convex/counts";
import { clearSyncState } from "@repo/backend/scripts/sync-content/runtime/files";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type BatchDeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number; hasMore: boolean }
>;

/** One bounded Convex table reset step in the audio reset sequence. */
interface ResetAudioStep {
  label: string;
  mutation: BatchDeleteMutation;
  resultLabel: string;
}

const RESET_AUDIO_STEPS: ResetAudioStep[] = [
  {
    label: "Deleting audio generation queue...",
    mutation:
      internal.contentSync.reset.internal.deleteAudioGenerationQueueBatch,
    resultLabel: "audio generation queue entries",
  },
  {
    label: "Deleting generated content audio...",
    mutation: internal.contentSync.reset.internal.deleteContentAudiosBatch,
    resultLabel: "generated content audio rows",
  },
  {
    label: "Deleting audio content sources...",
    mutation:
      internal.contentSync.reset.internal.deleteAudioContentSourcesBatch,
    resultLabel: "audio content sources",
  },
];

/** Deletes every row reachable by one audio batch reset mutation. */
const deleteAllBatched = Effect.fn("sync.resetAudio.deleteAllBatched")(
  function* (
    config: ConvexConfig,
    mutation: BatchDeleteMutation,
    label: string
  ) {
    let totalDeleted = 0;
    let batchNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const result = yield* callConvexMutation(
        config,
        mutation,
        {},
        BatchDeleteResultSchema
      );
      totalDeleted += result.deleted;
      hasMore = result.hasMore;

      if (result.deleted === 0) {
        continue;
      }

      yield* Effect.sync(() =>
        process.stdout.write(
          `\r  Batch ${batchNumber}: deleted ${totalDeleted} ${label}...`
        )
      );
      batchNumber += 1;
    }

    if (totalDeleted > 0) {
      yield* Effect.sync(() => process.stdout.write("\n"));
    }

    return totalDeleted;
  }
);

/** Deletes graph-derived audio rows so a full sync can rebuild audio sources. */
export const resetAudio = Effect.fn("sync.resetAudio")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== RESET AUDIO READ MODELS ===\n");
  log(
    "This deletes audio source rows, generated content audio rows, and pending audio generation queue rows."
  );
  log("Run a full sync afterward so Convex rebuilds audio source rows.\n");

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning(
      "This will permanently delete production audio source, generated audio, and audio queue rows.\n"
    );
  }

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  const counts = yield* getContentCounts(config);
  const totalAudioRows =
    counts.audioContentSources +
    counts.contentAudios +
    counts.audioGenerationQueue;

  log("Current audio database contents:\n");
  log(`  Audio Content Sources: ${counts.audioContentSources}`);
  log(`  Content Audios:        ${counts.contentAudios}`);
  log(`  Audio Queue:           ${counts.audioGenerationQueue}`);
  log(`\n  Total audio rows:      ${totalAudioRows}`);

  if (totalAudioRows === 0) {
    logSuccess("\nAudio read models are already empty.");
    yield* clearSyncState(options.prod ?? false);
    log("Cleared sync state file");
    return;
  }

  if (!options.force) {
    log("\nTo delete audio read models, run:");
    if (options.prod) {
      log("  pnpm --filter @repo/backend sync:prod:reset:audio --force");
      return;
    }

    log("  pnpm --filter @repo/backend sync:reset:audio --force");
    return;
  }

  log("\nDeleting audio read models (in dependency order)...\n");
  const startTime = performance.now();
  let totalDeleted = 0;

  for (const [index, step] of RESET_AUDIO_STEPS.entries()) {
    log(`${index + 1}/${RESET_AUDIO_STEPS.length} ${step.label}`);
    const deleted = yield* deleteAllBatched(
      config,
      step.mutation,
      step.resultLabel
    );
    logSuccess(`  Deleted ${deleted} ${step.resultLabel}`);
    totalDeleted += deleted;
  }

  log("\n=== RESET AUDIO COMPLETE ===\n");
  logSuccess(`Deleted ${totalDeleted} audio rows across sync-managed tables`);
  log(`Duration: ${formatDuration(performance.now() - startTime)}`);
  yield* clearSyncState(options.prod ?? false);
  log("Cleared sync state file");

  log("\nRun a full sync next:");
  if (options.prod) {
    log("  pnpm --filter @repo/backend sync:prod");
    return;
  }

  log("  pnpm --filter @repo/backend sync");
});
