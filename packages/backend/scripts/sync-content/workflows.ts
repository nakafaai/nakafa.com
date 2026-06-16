import { internal } from "@repo/backend/convex/_generated/api";
import {
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { syncArticles } from "@repo/backend/scripts/sync-content/articles";
import {
  collectAuthorNamesFromFiles,
  syncAuthors,
} from "@repo/backend/scripts/sync-content/authors";
import { invalidateContentRuntimeCache } from "@repo/backend/scripts/sync-content/cache";
import { clean } from "@repo/backend/scripts/sync-content/clean";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import {
  syncCurriculumLessons,
  syncCurriculumTopics,
} from "@repo/backend/scripts/sync-content/curriculum";
import {
  syncExerciseQuestions,
  syncExerciseSets,
} from "@repo/backend/scripts/sync-content/exercises";
import { syncLearningPrograms } from "@repo/backend/scripts/sync-content/learningPrograms";
import {
  formatDuration,
  formatSyncResult,
  log,
  logError,
  logSuccess,
  logSyncMetrics,
} from "@repo/backend/scripts/sync-content/logging";
import {
  addPhaseMetrics,
  createMetrics,
  endPhase,
  finalizeMetrics,
  startPhase,
} from "@repo/backend/scripts/sync-content/metrics";
import { syncQuran } from "@repo/backend/scripts/sync-content/quran";
import { syncGeneratedReadModels } from "@repo/backend/scripts/sync-content/readModels";
import { syncContentRouteArtifactPages } from "@repo/backend/scripts/sync-content/routes";
import {
  getChangedFilesSince,
  getCurrentGitCommit,
  loadSyncState,
  saveSyncState,
} from "@repo/backend/scripts/sync-content/runtime";
import {
  AuthorSyncResultSchema,
  BATCH_SIZES,
} from "@repo/backend/scripts/sync-content/schemas";
import { syncTryouts } from "@repo/backend/scripts/sync-content/tryouts";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import { verify } from "@repo/backend/scripts/sync-content/verify";
import { Effect } from "effect";

/** Prints the combined sync summary, including Quran runtime/search rows. */
const logSyncSummary = (
  authorResult: { created: number },
  articleResult: SyncResult,
  curriculumTopicResult: SyncResult,
  curriculumLessonResult: SyncResult,
  exerciseSetResult: SyncResult,
  exerciseQuestionResult: SyncResult,
  quranResult: SyncResult,
  tryoutResult: SyncResult,
  routePageResult: SyncResult,
  generatedReadModelResult: SyncResult,
  learningProgramResult: SyncResult
): void => {
  const totalCreated =
    articleResult.created +
    curriculumTopicResult.created +
    curriculumLessonResult.created +
    exerciseSetResult.created +
    exerciseQuestionResult.created +
    quranResult.created +
    tryoutResult.created +
    routePageResult.created +
    generatedReadModelResult.created +
    learningProgramResult.created;
  const totalUpdated =
    articleResult.updated +
    curriculumTopicResult.updated +
    curriculumLessonResult.updated +
    exerciseSetResult.updated +
    exerciseQuestionResult.updated +
    quranResult.updated +
    tryoutResult.updated +
    routePageResult.updated +
    generatedReadModelResult.updated +
    learningProgramResult.updated;
  const total =
    totalCreated +
    totalUpdated +
    articleResult.unchanged +
    curriculumTopicResult.unchanged +
    curriculumLessonResult.unchanged +
    exerciseSetResult.unchanged +
    exerciseQuestionResult.unchanged +
    quranResult.unchanged +
    tryoutResult.unchanged +
    routePageResult.unchanged +
    generatedReadModelResult.unchanged +
    learningProgramResult.unchanged;
  const totalAuthorLinksCreated =
    (articleResult.authorLinksCreated || 0) +
    (curriculumLessonResult.authorLinksCreated || 0) +
    (exerciseQuestionResult.authorLinksCreated || 0);

  log("\n=== SYNC SUMMARY ===\n");
  log("Primary Content:");
  log(
    `  Articles:           ${articleResult.created + articleResult.updated + articleResult.unchanged} (${articleResult.created} new, ${articleResult.updated} updated)`
  );
  log(
    `  Curriculum Topics:     ${curriculumTopicResult.created + curriculumTopicResult.updated + curriculumTopicResult.unchanged} (${curriculumTopicResult.created} new, ${curriculumTopicResult.updated} updated)`
  );
  log(
    `  Curriculum Lessons:   ${curriculumLessonResult.created + curriculumLessonResult.updated + curriculumLessonResult.unchanged} (${curriculumLessonResult.created} new, ${curriculumLessonResult.updated} updated)`
  );
  log(
    `  Exercise Sets:      ${exerciseSetResult.created + exerciseSetResult.updated + exerciseSetResult.unchanged} (${exerciseSetResult.created} new, ${exerciseSetResult.updated} updated)`
  );
  log(
    `  Exercise Questions: ${exerciseQuestionResult.created + exerciseQuestionResult.updated + exerciseQuestionResult.unchanged} (${exerciseQuestionResult.created} new, ${exerciseQuestionResult.updated} updated)`
  );
  log(
    `  Quran:              ${quranResult.created + quranResult.updated + quranResult.unchanged} (${quranResult.created} new, ${quranResult.updated} updated)`
  );
  log(
    `  Tryouts:            ${tryoutResult.created + tryoutResult.updated + tryoutResult.unchanged} (${tryoutResult.created} new, ${tryoutResult.updated} updated)`
  );
  log(
    `  Route Pages:         ${routePageResult.created + routePageResult.updated + routePageResult.unchanged} (${routePageResult.created} new, ${routePageResult.updated} updated)`
  );
  log(
    `  Generated Models:    ${generatedReadModelResult.created + generatedReadModelResult.updated + generatedReadModelResult.unchanged} (${generatedReadModelResult.created} new, ${generatedReadModelResult.updated} updated)`
  );
  log(
    `  Learning Programs:   ${learningProgramResult.created + learningProgramResult.updated + learningProgramResult.unchanged} (${learningProgramResult.created} new, ${learningProgramResult.updated} updated)`
  );

  log("\nRelated Items:");
  if (authorResult.created > 0) {
    log(`  Authors:              ${authorResult.created} new`);
  }
  if ((articleResult.referencesCreated || 0) > 0) {
    log(`  Article References:   ${articleResult.referencesCreated || 0}`);
  }
  if ((exerciseQuestionResult.choicesCreated || 0) > 0) {
    log(
      `  Exercise Choices:     ${exerciseQuestionResult.choicesCreated || 0}`
    );
  }
  if (totalAuthorLinksCreated > 0) {
    log(`  Content-Author Links: ${totalAuthorLinksCreated}`);
  }

  log("\nOverall:");
  log(`  Total: ${total} items synced`);
  if (totalCreated > 0 || totalUpdated > 0) {
    log(`  Changes: ${totalCreated} created, ${totalUpdated} updated`);
  } else {
    log("  All content up to date");
  }
};

/** Clears the route-page locale filter after cleanup may have deleted all locales. */
function getRoutePageOptionsAfterGlobalCleanup(
  options: SyncOptions,
  cleanResult: { deleted: number }
): SyncOptions {
  if (cleanResult.deleted > 0 && options.locale) {
    return { ...options, locale: undefined };
  }

  return options;
}

/** Runs the complete content sync in dependency-safe phases. */
export const syncAll = Effect.fn("sync.all")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const metrics = createMetrics();
  log("=== CONTENT SYNC ===\n");

  if (options.locale) {
    log(`Locale: ${options.locale}`);
  }
  if (options.sequential) {
    log("Mode: sequential\n");
  }

  log("Phase 0: Pre-syncing authors...");
  const authorResult = yield* syncAuthors(config, { ...options, quiet: true });
  log(
    `  Authors: ${authorResult.created} new, ${authorResult.existing} existing`
  );
  log(`  Duration: ${formatDuration(authorResult.durationMs || 0)}\n`);

  let articleResult: SyncResult;
  let curriculumTopicResult: SyncResult;
  let curriculumLessonResult: SyncResult;
  let exerciseSetResult: SyncResult;
  let exerciseQuestionResult: SyncResult;
  let quranResult: SyncResult;
  let tryoutResult: SyncResult;
  let routePageResult: SyncResult;
  let generatedReadModelResult: SyncResult;
  let learningProgramResult: SyncResult;

  if (options.sequential) {
    const articlePhase = startPhase(metrics, "Articles");
    articleResult = yield* syncArticles(config, options);
    endPhase(
      articlePhase,
      articleResult.created + articleResult.updated + articleResult.unchanged
    );

    const topicPhase = startPhase(metrics, "Curriculum Topics");
    curriculumTopicResult = yield* syncCurriculumTopics(config, options);
    endPhase(
      topicPhase,
      curriculumTopicResult.created +
        curriculumTopicResult.updated +
        curriculumTopicResult.unchanged
    );

    const sectionPhase = startPhase(metrics, "Curriculum Lessons");
    curriculumLessonResult = yield* syncCurriculumLessons(config, options);
    endPhase(
      sectionPhase,
      curriculumLessonResult.created +
        curriculumLessonResult.updated +
        curriculumLessonResult.unchanged
    );

    const setPhase = startPhase(metrics, "Exercise Sets");
    exerciseSetResult = yield* syncExerciseSets(config, options);
    endPhase(
      setPhase,
      exerciseSetResult.created +
        exerciseSetResult.updated +
        exerciseSetResult.unchanged
    );

    const questionPhase = startPhase(metrics, "Exercise Questions");
    exerciseQuestionResult = yield* syncExerciseQuestions(config, options);
    endPhase(
      questionPhase,
      exerciseQuestionResult.created +
        exerciseQuestionResult.updated +
        exerciseQuestionResult.unchanged
    );

    const quranPhase = startPhase(metrics, "Quran");
    quranResult = yield* syncQuran(config, options);
    endPhase(
      quranPhase,
      quranResult.created + quranResult.updated + quranResult.unchanged
    );

    const tryoutPhase = startPhase(metrics, "Tryouts");
    tryoutResult = yield* syncTryouts(config, options);
    endPhase(
      tryoutPhase,
      tryoutResult.created + tryoutResult.updated + tryoutResult.unchanged
    );

    const routePagePhase = startPhase(metrics, "Route Pages");
    routePageResult = yield* syncContentRouteArtifactPages(config, options);
    endPhase(
      routePagePhase,
      routePageResult.created +
        routePageResult.updated +
        routePageResult.unchanged
    );

    const generatedModelPhase = startPhase(metrics, "Generated Read Models");
    generatedReadModelResult = yield* syncGeneratedReadModels(config, options);
    endPhase(
      generatedModelPhase,
      generatedReadModelResult.created +
        generatedReadModelResult.updated +
        generatedReadModelResult.unchanged
    );

    const learningProgramPhase = startPhase(metrics, "Learning Programs");
    learningProgramResult = yield* syncLearningPrograms(config, options);
    endPhase(
      learningProgramPhase,
      learningProgramResult.created +
        learningProgramResult.updated +
        learningProgramResult.unchanged
    );
  } else {
    const quietOptions = { ...options, quiet: true };

    log("Phase 1: Syncing articles, topics, and sets...");
    const phase1Start = performance.now();
    [articleResult, curriculumTopicResult, exerciseSetResult] =
      yield* Effect.all([
        syncArticles(config, quietOptions),
        syncCurriculumTopics(config, quietOptions),
        syncExerciseSets(config, quietOptions),
      ]);
    log(`  Articles:       ${formatSyncResult(articleResult)}`);
    log(`  Curriculum Topics: ${formatSyncResult(curriculumTopicResult)}`);
    log(`  Exercise Sets:  ${formatSyncResult(exerciseSetResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase1Start)}\n`);

    log("Phase 2: Syncing sections and questions...");
    const phase2Start = performance.now();
    [curriculumLessonResult, exerciseQuestionResult] = yield* Effect.all([
      syncCurriculumLessons(config, quietOptions),
      syncExerciseQuestions(config, quietOptions),
    ]);
    log(`  Curriculum Lessons:   ${formatSyncResult(curriculumLessonResult)}`);
    log(`  Exercise Questions: ${formatSyncResult(exerciseQuestionResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase2Start)}`);

    log("Phase 3: Syncing Quran runtime data...");
    const phase3Start = performance.now();
    quranResult = yield* syncQuran(config, quietOptions);
    log(`  Quran:              ${formatSyncResult(quranResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase3Start)}`);

    log("Phase 4: Syncing tryouts...");
    const phase4Start = performance.now();
    tryoutResult = yield* syncTryouts(config, options);
    log(`  Tryouts:            ${formatSyncResult(tryoutResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase4Start)}`);

    log("Phase 5: Materializing route artifact pages...");
    const phase5Start = performance.now();
    routePageResult = yield* syncContentRouteArtifactPages(config, options);
    log(`  Route Pages:         ${formatSyncResult(routePageResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase5Start)}`);

    log("Phase 6: Syncing learning programs and coverage...");
    const phase6Start = performance.now();
    generatedReadModelResult = yield* syncGeneratedReadModels(config, options);
    log(`  Generated Models:    ${formatSyncResult(generatedReadModelResult)}`);
    learningProgramResult = yield* syncLearningPrograms(config, options);
    log(`  Learning Programs:   ${formatSyncResult(learningProgramResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase6Start)}`);

    addPhaseMetrics(metrics, "Articles", articleResult);
    addPhaseMetrics(metrics, "Curriculum Topics", curriculumTopicResult);
    addPhaseMetrics(metrics, "Curriculum Lessons", curriculumLessonResult);
    addPhaseMetrics(metrics, "Exercise Sets", exerciseSetResult);
    addPhaseMetrics(metrics, "Exercise Questions", exerciseQuestionResult);
    addPhaseMetrics(metrics, "Quran", quranResult);
    addPhaseMetrics(metrics, "Tryouts", tryoutResult);
    addPhaseMetrics(metrics, "Route Pages", routePageResult);
    addPhaseMetrics(metrics, "Generated Read Models", generatedReadModelResult);
    addPhaseMetrics(metrics, "Learning Programs", learningProgramResult);
  }

  finalizeMetrics(metrics);
  logSyncSummary(
    authorResult,
    articleResult,
    curriculumTopicResult,
    curriculumLessonResult,
    exerciseSetResult,
    exerciseQuestionResult,
    quranResult,
    tryoutResult,
    routePageResult,
    generatedReadModelResult,
    learningProgramResult
  );
  logSyncMetrics(metrics);
});

/** Runs a content sync limited to changed content files when possible. */
export const syncIncremental = Effect.fn("sync.incremental")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const metrics = createMetrics();
  log("=== INCREMENTAL SYNC ===\n");

  const syncState = yield* loadSyncState(options.prod ?? false);
  const currentCommit = yield* getCurrentGitCommit();

  if (!syncState?.lastSyncCommit) {
    log("No previous sync state found. Running full sync...\n");
    yield* syncAll(config, options);
    yield* invalidateContentRuntimeCache(options);
    yield* saveSyncState(
      { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
      options.prod ?? false
    );
    return;
  }

  if (!currentCommit) {
    log("Git not available. Running full sync...\n");
    yield* syncAll(config, options);
    yield* invalidateContentRuntimeCache(options);
    return;
  }

  log(`Last sync: ${new Date(syncState.lastSyncTimestamp).toISOString()}`);
  log(`Last commit: ${syncState.lastSyncCommit.slice(0, 8)}`);
  log(`Current commit: ${currentCommit.slice(0, 8)}\n`);

  const changedFiles = yield* getChangedFilesSince(syncState.lastSyncCommit);
  if (changedFiles.size === 0) {
    logSuccess(
      "No tracked or untracked content files changed. Refreshing runtime read models..."
    );
    const quranResult = yield* syncQuran(config, {
      ...options,
      quiet: true,
    });
    addPhaseMetrics(metrics, "Quran", quranResult);

    const routePageResult = yield* syncContentRouteArtifactPages(
      config,
      options
    );
    addPhaseMetrics(metrics, "Route Pages", routePageResult);

    const generatedReadModelResult = yield* syncGeneratedReadModels(
      config,
      options
    );
    addPhaseMetrics(metrics, "Generated Read Models", generatedReadModelResult);

    const learningProgramResult = yield* syncLearningPrograms(config, options);
    addPhaseMetrics(metrics, "Learning Programs", learningProgramResult);

    finalizeMetrics(metrics);
    logSyncMetrics(metrics);
    yield* invalidateContentRuntimeCache(options);
    yield* saveSyncState(
      { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
      options.prod ?? false
    );
    return;
  }

  log(`Changed files: ${changedFiles.size}\n`);
  const changedFilesArray = [...changedFiles];
  const changedAuthorNames =
    yield* collectAuthorNamesFromFiles(changedFilesArray);

  if (changedAuthorNames.length > 0) {
    log("Phase 0: Pre-syncing authors from changed files...");
    let created = 0;
    let existing = 0;

    for (
      let index = 0;
      index < changedAuthorNames.length;
      index += BATCH_SIZES.authors
    ) {
      const batch = changedAuthorNames.slice(
        index,
        index + BATCH_SIZES.authors
      );
      const authorResult = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.authors.bulkSyncAuthors,
        { authorNames: batch },
        AuthorSyncResultSchema
      );

      created += authorResult.created;
      existing += authorResult.existing;
    }

    log(`  Authors: ${created} new, ${existing} existing\n`);
  }

  const hasArticleChanges = changedFilesArray.some((file) =>
    file.includes("/articles/")
  );
  const hasMaterialChanges = changedFilesArray.some((file) =>
    file.includes("/material/")
  );
  const hasCurriculumMaterialChanges = changedFilesArray.some((file) =>
    file.includes("/curriculum/")
  );
  const hasExerciseChanges = changedFilesArray.some((file) =>
    file.includes("/assessment/")
  );

  let articleResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let curriculumTopicResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  let curriculumLessonResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  let exerciseSetResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let exerciseQuestionResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  let quranResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let routePageResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let generatedReadModelResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  let learningProgramResult: SyncResult = {
    created: 0,
    unchanged: 0,
    updated: 0,
  };

  if (hasArticleChanges) {
    log("Articles changed - syncing...");
    articleResult = yield* syncArticles(config, options);
    addPhaseMetrics(metrics, "Articles", articleResult);
  } else {
    log("Articles: no changes");
  }

  if (hasMaterialChanges || hasCurriculumMaterialChanges) {
    log("Curriculum material changed - syncing...");
    curriculumTopicResult = yield* syncCurriculumTopics(config, options);
    curriculumLessonResult = yield* syncCurriculumLessons(config, options);
    addPhaseMetrics(metrics, "Curriculum Topics", curriculumTopicResult);
    addPhaseMetrics(metrics, "Curriculum Lessons", curriculumLessonResult);
  } else {
    log("Curriculum: no changes");
  }

  if (hasExerciseChanges) {
    log("Exercises changed - syncing...");
    exerciseSetResult = yield* syncExerciseSets(config, options);
    exerciseQuestionResult = yield* syncExerciseQuestions(config, options);
    addPhaseMetrics(metrics, "Exercise Sets", exerciseSetResult);
    addPhaseMetrics(metrics, "Exercise Questions", exerciseQuestionResult);
  } else {
    log("Exercises: no changes");
  }

  const hasContentRouteChanges =
    hasArticleChanges ||
    hasMaterialChanges ||
    hasCurriculumMaterialChanges ||
    hasExerciseChanges;
  let routePageOptions = options;

  if (hasContentRouteChanges) {
    log("Cleaning stale content before route artifact pages...");
    const cleanResult = yield* clean(config, {
      ...options,
      force: true,
    });
    routePageOptions = getRoutePageOptionsAfterGlobalCleanup(
      options,
      cleanResult
    );
  }

  quranResult = yield* syncQuran(config, {
    ...options,
    quiet: true,
  });
  addPhaseMetrics(metrics, "Quran", quranResult);

  routePageResult = yield* syncContentRouteArtifactPages(
    config,
    routePageOptions
  );
  addPhaseMetrics(metrics, "Route Pages", routePageResult);

  if (
    hasMaterialChanges ||
    hasCurriculumMaterialChanges ||
    hasExerciseChanges
  ) {
    generatedReadModelResult = yield* syncGeneratedReadModels(
      config,
      routePageOptions
    );
    addPhaseMetrics(metrics, "Generated Read Models", generatedReadModelResult);
  }

  learningProgramResult = yield* syncLearningPrograms(config, routePageOptions);
  addPhaseMetrics(metrics, "Learning Programs", learningProgramResult);

  finalizeMetrics(metrics);
  log("\n=== SUMMARY ===\n");

  const totalCreated =
    articleResult.created +
    curriculumTopicResult.created +
    curriculumLessonResult.created +
    exerciseSetResult.created +
    exerciseQuestionResult.created +
    quranResult.created +
    routePageResult.created +
    generatedReadModelResult.created +
    learningProgramResult.created;
  const totalUpdated =
    articleResult.updated +
    curriculumTopicResult.updated +
    curriculumLessonResult.updated +
    exerciseSetResult.updated +
    exerciseQuestionResult.updated +
    quranResult.updated +
    routePageResult.updated +
    generatedReadModelResult.updated +
    learningProgramResult.updated;
  if (totalCreated > 0 || totalUpdated > 0) {
    log(`Changes: ${totalCreated} created, ${totalUpdated} updated`);
  } else {
    log("No changes (all content up to date)");
  }

  logSyncMetrics(metrics);
  yield* invalidateContentRuntimeCache(options);
  yield* saveSyncState(
    { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
    options.prod ?? false
  );
  log("\n=== INCREMENTAL SYNC COMPLETE ===");
  logSuccess("Sync state saved for next incremental sync");
});

/** Runs sync, stale cleanup, verification, and incremental-state save. */
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
        force: true,
        authors: true,
      });
      if (cleanResult.hasStale && cleanResult.deleted) {
        log("\nStale content was found and deleted.");
        log("Rebuilding route artifact pages after stale cleanup...");
        const routePageOptions = getRoutePageOptionsAfterGlobalCleanup(
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
        { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
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
