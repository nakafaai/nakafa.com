import { internal } from "@repo/backend/convex/_generated/api";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import {
  formatDuration,
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/metrics";
import {
  readAssessmentRows,
  readCurriculumRows,
  readMaterialLocaleRows,
  readMaterialRows,
  readPublicRouteRows,
} from "@repo/backend/scripts/sync-content/readModels/rows";
import {
  BATCH_SIZES,
  GeneratedReadModelDeleteResultSchema,
  GeneratedReadModelSyncResultSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
} from "convex/server";
import { Effect } from "effect";

type SyncMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  SyncResult
>;

type DeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number }
>;

/** Syncs final generated material, curriculum, and assessment read models. */
export const syncGeneratedReadModels = Effect.fn("sync.generatedReadModels")(
  function* (config: ConvexConfig, options: SyncOptions) {
    const startTime = performance.now();
    const syncedAt = Date.now();

    if (!options.quiet) {
      log("\n--- GENERATED READ MODELS ---\n");
    }

    const materialResult = yield* syncMaterials(config, syncedAt, options);
    const materialLocaleResult = yield* syncMaterialLocales(
      config,
      syncedAt,
      options
    );
    const curriculumResult = yield* syncCurricula(config, syncedAt, options);
    const assessmentResult = yield* syncAssessments(config, syncedAt, options);
    const publicRouteResult = yield* syncPublicRoutes(
      config,
      syncedAt,
      options
    );
    const deleted = yield* deleteStaleGeneratedReadModels(
      config,
      syncedAt,
      options
    );

    const result = combineSyncResults([
      materialResult,
      materialLocaleResult,
      curriculumResult,
      assessmentResult,
      publicRouteResult,
    ]);
    const processed = result.created + result.updated + result.unchanged;
    const durationMs = performance.now() - startTime;
    const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

    if (!options.quiet) {
      log(
        `\nResult: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`
      );
      log(`Deleted stale generated rows: ${deleted}`);
      log(
        `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
      );
      logSuccess(`${processed} generated read model rows synced`);
    }

    return { ...result, durationMs, itemsPerSecond };
  }
);

/** Writes stable material catalog rows before locale-specific body rows. */
const syncMaterials = Effect.fn("sync.generatedMaterials")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
  const rows = readMaterialRows();

  return yield* syncBatches({
    batchSize: BATCH_SIZES.generatedMaterials,
    config,
    label: "Materials",
    mutation: internal.contentSync.mutations.readModels.bulkSyncMaterials,
    options,
    rows,
    toArgs: (batch) => ({ materials: batch, syncedAt }),
  });
});

/** Writes localized lesson and practice material rows for the selected locale scope. */
const syncMaterialLocales = Effect.fn("sync.generatedMaterialLocales")(
  function* (config: ConvexConfig, syncedAt: number, options: SyncOptions) {
    const rows = yield* readMaterialLocaleRows(options);

    return yield* syncBatches({
      batchSize: BATCH_SIZES.generatedMaterialLocales,
      config,
      label: "Material Locales",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncMaterialLocales,
      options,
      rows,
      toArgs: (batch) => ({ locales: batch, syncedAt }),
    });
  }
);

/** Writes curriculum program rows, hierarchy nodes, and material mappings together. */
const syncCurricula = Effect.fn("sync.generatedCurricula")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
  const { curriculumRows, materialRows, nodeRows } =
    yield* readCurriculumRows();

  return yield* Effect.gen(function* () {
    const curriculumResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedCurricula,
      config,
      label: "Curricula",
      mutation: internal.contentSync.mutations.readModels.bulkSyncCurricula,
      options,
      rows: curriculumRows,
      toArgs: (batch) => ({ curricula: batch, syncedAt }),
    });
    const nodeResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedCurriculumNodes,
      config,
      label: "Curriculum Nodes",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncCurriculumNodes,
      options,
      rows: nodeRows,
      toArgs: (batch) => ({ nodes: batch, syncedAt }),
    });
    const materialResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedCurriculumMaterials,
      config,
      label: "Curriculum Materials",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncCurriculumMaterials,
      options,
      rows: materialRows,
      toArgs: (batch) => ({ mappings: batch, syncedAt }),
    });

    return combineSyncResults([curriculumResult, nodeResult, materialResult]);
  });
});

/** Writes assessment program rows and source-owned assessment nodes. */
const syncAssessments = Effect.fn("sync.generatedAssessments")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
  const { assessmentRows, nodeRows } = readAssessmentRows();

  return yield* Effect.gen(function* () {
    const assessmentResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedAssessments,
      config,
      label: "Assessments",
      mutation: internal.contentSync.mutations.readModels.bulkSyncAssessments,
      options,
      rows: assessmentRows,
      toArgs: (batch) => ({ assessments: batch, syncedAt }),
    });
    const nodeResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedAssessmentNodes,
      config,
      label: "Assessment Nodes",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncAssessmentNodes,
      options,
      rows: nodeRows,
      toArgs: (batch) => ({ nodes: batch, syncedAt }),
    });

    return combineSyncResults([assessmentResult, nodeResult]);
  });
});

/** Writes the unified public route read model used by app, SEO, and lookup paths. */
const syncPublicRoutes = Effect.fn("sync.generatedPublicRoutes")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
  const rows = yield* readPublicRouteRows();

  return yield* syncBatches({
    batchSize: BATCH_SIZES.generatedPublicRoutes,
    config,
    label: "Public Routes",
    mutation: internal.contentSync.mutations.readModels.bulkSyncPublicRoutes,
    options,
    rows,
    toArgs: (batch) => ({ routes: batch, syncedAt }),
  });
});

/** Combines independent batch sync totals without changing row-level semantics. */
function combineSyncResults(results: readonly SyncResult[]): SyncResult {
  return results.reduce(
    (total, result) => ({
      created: total.created + result.created,
      unchanged: total.unchanged + result.unchanged,
      updated: total.updated + result.updated,
    }),
    { created: 0, unchanged: 0, updated: 0 }
  );
}

/**
 * Sends rows to one Convex mutation in bounded batches.
 *
 * The caller owns row construction and mutation argument shape; this Module owns
 * batch progress, result validation, and aggregate totals.
 */
function syncBatches<Row, TFunction extends SyncMutation>({
  batchSize,
  config,
  label,
  mutation,
  options,
  rows,
  toArgs,
}: {
  batchSize: number;
  config: ConvexConfig;
  label: string;
  mutation: TFunction;
  options: SyncOptions;
  rows: readonly Row[];
  toArgs: (batch: Row[]) => FunctionArgs<TFunction>;
}) {
  return Effect.gen(function* () {
    const totals: SyncResult = { created: 0, unchanged: 0, updated: 0 };
    const totalBatches = Math.ceil(rows.length / batchSize);
    const progress = createBatchProgress(rows.length, batchSize);

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const batchNum = Math.floor(index / batchSize) + 1;

      if (!options.quiet) {
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        mutation,
        toArgs(batch),
        GeneratedReadModelSyncResultSchema
      );

      totals.created += result.created;
      totals.updated += result.updated;
      totals.unchanged += result.unchanged;
      updateBatchProgress(progress, batch.length);
    }

    if (!options.quiet) {
      log(`  ${label}: ${totals.created} new, ${totals.updated} updated`);
    }

    return totals;
  });
}

/** Deletes generated read-model rows whose `syncedAt` was not refreshed. */
const deleteStaleGeneratedReadModels = Effect.fn(
  "sync.deleteStaleGeneratedReadModels"
)(function* (config: ConvexConfig, syncedAt: number, options: SyncOptions) {
  const materialLocales = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale.deleteStaleMaterialLocales,
    {
      limit: BATCH_SIZES.generatedMaterialLocales,
      locale: options.locale,
      syncedAt,
    }
  );
  const materials = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale.deleteStaleMaterials,
    { limit: BATCH_SIZES.generatedMaterials, syncedAt }
  );
  const curriculumMaterials = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale
      .deleteStaleCurriculumMaterials,
    { limit: BATCH_SIZES.generatedCurriculumMaterials, syncedAt }
  );
  const curriculumNodes = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale.deleteStaleCurriculumNodes,
    { limit: BATCH_SIZES.generatedCurriculumNodes, syncedAt }
  );
  const curricula = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale.deleteStaleCurricula,
    { limit: BATCH_SIZES.generatedCurricula, syncedAt }
  );
  const assessmentNodes = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale.deleteStaleAssessmentNodes,
    { limit: BATCH_SIZES.generatedAssessmentNodes, syncedAt }
  );
  const assessments = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale.deleteStaleAssessments,
    { limit: BATCH_SIZES.generatedAssessments, syncedAt }
  );
  const publicRoutes = yield* deleteAllStaleRows(
    config,
    internal.contentSync.mutations.readModels.stale.deleteStalePublicRoutes,
    { limit: BATCH_SIZES.generatedPublicRoutes, syncedAt }
  );

  return (
    materialLocales +
    materials +
    curriculumMaterials +
    curriculumNodes +
    curricula +
    assessmentNodes +
    assessments +
    publicRoutes
  );
});

/**
 * Repeats one bounded stale-row deletion mutation until the batch is exhausted.
 *
 * Convex mutations stay within transaction limits because every invocation
 * deletes at most the configured batch size.
 */
function deleteAllStaleRows<TFunction extends DeleteMutation>(
  config: ConvexConfig,
  mutation: TFunction,
  args: FunctionArgs<TFunction> & { limit: number }
) {
  return Effect.gen(function* () {
    let deleted = 0;

    while (true) {
      const result = yield* callConvexMutation(
        config,
        mutation,
        args,
        GeneratedReadModelDeleteResultSchema
      );

      deleted += result.deleted;

      if (result.deleted < args.limit) {
        return deleted;
      }
    }
  });
}
