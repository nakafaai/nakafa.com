import { internal } from "@repo/backend/convex/_generated/api";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import { computeHash } from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  formatDuration,
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { readValidatedExerciseQuestionCounts } from "@repo/backend/scripts/sync-content/content/practice/questions";
import {
  readExerciseSearchLabels,
  readPracticeCategory,
} from "@repo/backend/scripts/sync-content/content/practice/source";
import {
  BATCH_SIZES,
  ExerciseSetSyncResultSchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { readPublicContentRoute } from "@repo/backend/scripts/sync-content/routes/public";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/workflow/metrics";
import {
  getExerciseSetSearchDescription,
  getExerciseSetSearchText,
  getExerciseSetSearchTitle,
} from "@repo/contents/_lib/assessment/search";
import { getExerciseSetGroupRoute } from "@repo/contents/_types/graph/projection";
import { listPracticeSets } from "@repo/contents/_types/material/registry";
import { isPracticeSetRoute } from "@repo/contents/_types/route/content";
import { Effect } from "effect";

/** Syncs exercise set metadata from typed Material sources into Convex. */
export const syncExerciseSets = Effect.fn("sync.exerciseSets")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- EXERCISE SETS ---\n");
  }

  const materialSets = listPracticeSets(options.locale);

  if (!options.quiet) {
    log(`Material sets found: ${materialSets.length}`);
  }

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const searchLabelsBySet = yield* readExerciseSearchLabels(options);
  const questionCountByLocaleSlug = yield* readValidatedExerciseQuestionCounts(
    options,
    searchLabelsBySet
  );
  const sets = yield* Effect.forEach(materialSets, (set) =>
    Effect.gen(function* () {
      const category = readPracticeCategory(set.assessment);
      const countKey = `${set.locale}:${set.slug}`;
      const questionCount = questionCountByLocaleSlug.get(countKey) || 0;
      const searchSource = {
        locale: set.locale,
        category,
        type: set.assessment,
        material: set.domain,
        exerciseType: set.exerciseType,
        exerciseTypeTitle: set.exerciseTypeTitle,
        setName: set.setName,
        setTitle: set.title,
        year: set.year,
        questionCount,
        description: set.description,
      };
      const searchTitle = getExerciseSetSearchTitle(searchSource);
      const searchDescription = getExerciseSetSearchDescription(searchSource);
      const searchText = getExerciseSetSearchText(searchSource);
      const groupRoute = yield* readExerciseSetGroupRoute(set.slug);
      const publicRoute = yield* readPublicContentRoute(set.slug, set.locale);

      if (!isPracticeSetRoute(publicRoute)) {
        return yield* Effect.fail(
          new ScriptFailureError({
            message: `Expected public exercise set route for ${set.locale}:${set.slug}.`,
          })
        );
      }

      return {
        locale: set.locale,
        slug: set.slug,
        publicPath: publicRoute.publicPath,
        groupPublicPath: publicRoute.parentPath,
        category,
        type: set.assessment,
        material: set.domain,
        exerciseType: set.exerciseType,
        exerciseTypeTitle: set.exerciseTypeTitle,
        setName: set.setName,
        title: set.title,
        description: set.description,
        year: set.year === undefined ? undefined : String(set.year),
        questionCount,
        searchTitle,
        searchDescription,
        searchText,
        groupContentHash: computeHash(
          JSON.stringify({
            description: set.description,
            exerciseType: set.exerciseType,
            exerciseTypeTitle: set.exerciseTypeTitle,
            groupRoute,
            groupPublicPath: publicRoute.parentPath,
            locale: set.locale,
            year: set.year,
          })
        ),
        contentHash: computeHash(
          JSON.stringify({
            description: set.description,
            questionCount,
            searchDescription,
            searchText,
            searchTitle,
            publicPath: publicRoute.publicPath,
            slug: set.slug,
            year: set.year,
          })
        ),
      };
    })
  );

  if (!options.quiet) {
    log(`Sets parsed: ${sets.length}`);
  }

  const totalBatches = Math.ceil(sets.length / BATCH_SIZES.exerciseSets);
  const progress = createBatchProgress(sets.length, BATCH_SIZES.exerciseSets);

  for (let index = 0; index < sets.length; index += BATCH_SIZES.exerciseSets) {
    const batch = sets.slice(index, index + BATCH_SIZES.exerciseSets);
    const batchNum = Math.floor(index / BATCH_SIZES.exerciseSets) + 1;

    if (!options.quiet) {
      log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));
    }

    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: batch },
      ExerciseSetSyncResultSchema
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (!options.quiet) {
    log(
      `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    log(
      `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
    );

    if (processed === sets.length) {
      logSuccess(`${processed} exercise sets synced`);
    } else {
      logError(`Mismatch: ${processed} processed vs ${sets.length} parsed`);
    }
  }

  return { ...totals, durationMs, itemsPerSecond };
});

/** Reads the graph-owned parent group route for one authored exercise set. */
const readExerciseSetGroupRoute = Effect.fn("sync.readExerciseSetGroupRoute")(
  function* (setSlug: string) {
    const groupRoute = getExerciseSetGroupRoute(setSlug);

    if (groupRoute) {
      return groupRoute;
    }

    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Exercise set route cannot be projected into a graph group route: ${setSlug}`,
      })
    );
  }
);
