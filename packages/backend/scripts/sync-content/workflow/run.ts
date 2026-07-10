import { internal } from "@repo/backend/convex/_generated/api";
import { clean } from "@repo/backend/scripts/sync-content/cleanup/clean";
import {
  formatDuration,
  formatSyncResult,
  log,
  logSuccess,
  logSyncMetrics,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { syncArticles } from "@repo/backend/scripts/sync-content/content/articles";
import {
  collectAuthorNamesFromFiles,
  syncAuthors,
} from "@repo/backend/scripts/sync-content/content/authors";
import {
  syncCurriculumLessons,
  syncCurriculumTopics,
} from "@repo/backend/scripts/sync-content/content/curriculum";
import { syncLearningPrograms } from "@repo/backend/scripts/sync-content/content/programs";
import { syncQuran } from "@repo/backend/scripts/sync-content/content/quran";
import { syncTryouts } from "@repo/backend/scripts/sync-content/content/tryouts";
import {
  AuthorSyncResultSchema,
  BATCH_SIZES,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { syncContentRouteArtifactPages } from "@repo/backend/scripts/sync-content/routes/artifacts";
import { readRoutePageOptionsAfterCleanup } from "@repo/backend/scripts/sync-content/routes/options";
import { syncPublicRoutes } from "@repo/backend/scripts/sync-content/routes/sync";
import { invalidateContentRuntimeCache } from "@repo/backend/scripts/sync-content/runtime/cache";
import {
  getChangedFilesSince,
  getCurrentGitCommit,
  loadSyncState,
  saveSyncState,
} from "@repo/backend/scripts/sync-content/runtime/files";
import {
  addPhaseMetrics,
  createMetrics,
  endPhase,
  finalizeMetrics,
  startPhase,
} from "@repo/backend/scripts/sync-content/workflow/metrics";
import { readIncrementalSyncPlan } from "@repo/backend/scripts/sync-content/workflow/plan";
import { logSyncSummary } from "@repo/backend/scripts/sync-content/workflow/summary";
import { Effect } from "effect";

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
  let quranResult: SyncResult;
  let tryoutResult: SyncResult;
  let routePageResult: SyncResult;
  let publicRouteResult: SyncResult;
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

    const publicRoutePhase = startPhase(metrics, "Public Routes");
    publicRouteResult = yield* syncPublicRoutes(config, options);
    endPhase(
      publicRoutePhase,
      publicRouteResult.created +
        publicRouteResult.updated +
        publicRouteResult.unchanged
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

    log("Phase 1: Syncing articles and topics...");
    const phase1Start = performance.now();
    [articleResult, curriculumTopicResult] = yield* Effect.all([
      syncArticles(config, quietOptions),
      syncCurriculumTopics(config, quietOptions),
    ]);
    log(`  Articles:       ${formatSyncResult(articleResult)}`);
    log(`  Curriculum Topics: ${formatSyncResult(curriculumTopicResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase1Start)}\n`);

    log("Phase 2: Syncing curriculum lessons...");
    const phase2Start = performance.now();
    curriculumLessonResult = yield* syncCurriculumLessons(config, quietOptions);
    log(`  Curriculum Lessons:   ${formatSyncResult(curriculumLessonResult)}`);
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
    publicRouteResult = yield* syncPublicRoutes(config, options);
    log(`  Public Routes:    ${formatSyncResult(publicRouteResult)}`);
    learningProgramResult = yield* syncLearningPrograms(config, options);
    log(`  Learning Programs:   ${formatSyncResult(learningProgramResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase6Start)}`);

    addPhaseMetrics(metrics, "Articles", articleResult);
    addPhaseMetrics(metrics, "Curriculum Topics", curriculumTopicResult);
    addPhaseMetrics(metrics, "Curriculum Lessons", curriculumLessonResult);
    addPhaseMetrics(metrics, "Quran", quranResult);
    addPhaseMetrics(metrics, "Tryouts", tryoutResult);
    addPhaseMetrics(metrics, "Route Pages", routePageResult);
    addPhaseMetrics(metrics, "Public Routes", publicRouteResult);
    addPhaseMetrics(metrics, "Learning Programs", learningProgramResult);
  }

  finalizeMetrics(metrics);
  logSyncSummary(
    authorResult,
    articleResult,
    curriculumTopicResult,
    curriculumLessonResult,
    quranResult,
    tryoutResult,
    routePageResult,
    publicRouteResult,
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

    const publicRouteResult = yield* syncPublicRoutes(config, options);
    addPhaseMetrics(metrics, "Public Routes", publicRouteResult);

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

  const syncPlan = readIncrementalSyncPlan(changedFilesArray);

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
  let tryoutResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  let quranResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let routePageResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let publicRouteResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  let learningProgramResult: SyncResult = {
    created: 0,
    unchanged: 0,
    updated: 0,
  };

  const plannedRowPhases = new Set(syncPlan.rowPhases);

  for (const rowPhase of syncPlan.rowPhases) {
    if (rowPhase === "articles") {
      log("Article content rows changed - syncing...");
      articleResult = yield* syncArticles(config, options);
      addPhaseMetrics(metrics, "Articles", articleResult);
      continue;
    }

    if (rowPhase === "curriculum") {
      log("Curriculum content rows changed - syncing...");
      curriculumTopicResult = yield* syncCurriculumTopics(config, options);
      curriculumLessonResult = yield* syncCurriculumLessons(config, options);
      addPhaseMetrics(metrics, "Curriculum Topics", curriculumTopicResult);
      addPhaseMetrics(metrics, "Curriculum Lessons", curriculumLessonResult);
      continue;
    }

    log("Try-out source rows changed - syncing...");
    tryoutResult = yield* syncTryouts(config, options);
    addPhaseMetrics(metrics, "Tryouts", tryoutResult);
  }

  if (!plannedRowPhases.has("articles")) {
    log("Articles: no changes");
  }
  if (!plannedRowPhases.has("curriculum")) {
    log("Curriculum: no changes");
  }
  if (!plannedRowPhases.has("tryouts")) {
    log("Tryouts: no changes");
  }

  let routePageOptions = options;

  if (syncPlan.cleanBeforeRouteArtifacts) {
    log("Cleaning stale content before route artifact pages...");
    const cleanResult = yield* clean(config, {
      ...options,
      force: true,
    });
    routePageOptions = readRoutePageOptionsAfterCleanup(options, cleanResult);
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

  if (syncPlan.refreshPublicRoutes) {
    publicRouteResult = yield* syncPublicRoutes(config, routePageOptions);
    addPhaseMetrics(metrics, "Public Routes", publicRouteResult);
  }

  learningProgramResult = yield* syncLearningPrograms(config, routePageOptions);
  addPhaseMetrics(metrics, "Learning Programs", learningProgramResult);

  finalizeMetrics(metrics);
  log("\n=== SUMMARY ===\n");

  const totalCreated =
    articleResult.created +
    curriculumTopicResult.created +
    curriculumLessonResult.created +
    tryoutResult.created +
    quranResult.created +
    routePageResult.created +
    publicRouteResult.created +
    learningProgramResult.created;
  const totalUpdated =
    articleResult.updated +
    curriculumTopicResult.updated +
    curriculumLessonResult.updated +
    tryoutResult.updated +
    quranResult.updated +
    routePageResult.updated +
    publicRouteResult.updated +
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
