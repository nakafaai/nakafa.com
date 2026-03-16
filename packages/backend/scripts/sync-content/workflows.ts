import { syncArticles } from "./articles";
import { collectAuthorNamesFromFiles, syncAuthors } from "./authors";
import { clean } from "./clean";
import { runConvexMutationGeneric } from "./convexApi";
import { syncExerciseQuestions, syncExerciseSets } from "./exercises";
import {
  formatDuration,
  formatSyncResult,
  log,
  logError,
  logSuccess,
  logSyncMetrics,
} from "./logging";
import {
  addPhaseMetrics,
  createMetrics,
  endPhase,
  finalizeMetrics,
  startPhase,
} from "./metrics";
import {
  getChangedFilesSince,
  getCurrentGitCommit,
  loadSyncState,
  saveSyncState,
} from "./runtime";
import { AuthorSyncResultSchema } from "./schemas";
import { syncSubjectSections, syncSubjectTopics } from "./subjects";
import { syncTryouts } from "./tryouts";
import type { ConvexConfig, SyncOptions, SyncResult } from "./types";
import { verify } from "./verify";

const logSyncSummary = (
  authorResult: { created: number },
  articleResult: SyncResult,
  subjectTopicResult: SyncResult,
  subjectSectionResult: SyncResult,
  exerciseSetResult: SyncResult,
  exerciseQuestionResult: SyncResult,
  tryoutResult: SyncResult
): void => {
  const totalCreated =
    articleResult.created +
    subjectTopicResult.created +
    subjectSectionResult.created +
    exerciseSetResult.created +
    exerciseQuestionResult.created +
    tryoutResult.created;
  const totalUpdated =
    articleResult.updated +
    subjectTopicResult.updated +
    subjectSectionResult.updated +
    exerciseSetResult.updated +
    exerciseQuestionResult.updated +
    tryoutResult.updated;
  const total =
    totalCreated +
    totalUpdated +
    articleResult.unchanged +
    subjectTopicResult.unchanged +
    subjectSectionResult.unchanged +
    exerciseSetResult.unchanged +
    exerciseQuestionResult.unchanged +
    tryoutResult.unchanged;
  const totalAuthorLinksCreated =
    (articleResult.authorLinksCreated || 0) +
    (subjectSectionResult.authorLinksCreated || 0) +
    (exerciseQuestionResult.authorLinksCreated || 0);

  log("\n=== SYNC SUMMARY ===\n");
  log("Primary Content:");
  log(
    `  Articles:           ${articleResult.created + articleResult.updated + articleResult.unchanged} (${articleResult.created} new, ${articleResult.updated} updated)`
  );
  log(
    `  Subject Topics:     ${subjectTopicResult.created + subjectTopicResult.updated + subjectTopicResult.unchanged} (${subjectTopicResult.created} new, ${subjectTopicResult.updated} updated)`
  );
  log(
    `  Subject Sections:   ${subjectSectionResult.created + subjectSectionResult.updated + subjectSectionResult.unchanged} (${subjectSectionResult.created} new, ${subjectSectionResult.updated} updated)`
  );
  log(
    `  Exercise Sets:      ${exerciseSetResult.created + exerciseSetResult.updated + exerciseSetResult.unchanged} (${exerciseSetResult.created} new, ${exerciseSetResult.updated} updated)`
  );
  log(
    `  Exercise Questions: ${exerciseQuestionResult.created + exerciseQuestionResult.updated + exerciseQuestionResult.unchanged} (${exerciseQuestionResult.created} new, ${exerciseQuestionResult.updated} updated)`
  );
  log(
    `  Tryouts:            ${tryoutResult.created + tryoutResult.updated + tryoutResult.unchanged} (${tryoutResult.created} new, ${tryoutResult.updated} updated)`
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

export const syncAll = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> => {
  const metrics = createMetrics();
  log("=== CONTENT SYNC ===\n");

  if (options.locale) {
    log(`Locale: ${options.locale}`);
  }
  if (options.sequential) {
    log("Mode: sequential\n");
  }

  log("Phase 0: Pre-syncing authors...");
  const authorResult = await syncAuthors(config, { ...options, quiet: true });
  log(
    `  Authors: ${authorResult.created} new, ${authorResult.existing} existing`
  );
  log(`  Duration: ${formatDuration(authorResult.durationMs || 0)}\n`);

  let articleResult: SyncResult;
  let subjectTopicResult: SyncResult;
  let subjectSectionResult: SyncResult;
  let exerciseSetResult: SyncResult;
  let exerciseQuestionResult: SyncResult;
  let tryoutResult: SyncResult;

  if (options.sequential) {
    const articlePhase = startPhase(metrics, "Articles");
    articleResult = await syncArticles(config, options);
    endPhase(
      articlePhase,
      articleResult.created + articleResult.updated + articleResult.unchanged
    );

    const topicPhase = startPhase(metrics, "Subject Topics");
    subjectTopicResult = await syncSubjectTopics(config, options);
    endPhase(
      topicPhase,
      subjectTopicResult.created +
        subjectTopicResult.updated +
        subjectTopicResult.unchanged
    );

    const sectionPhase = startPhase(metrics, "Subject Sections");
    subjectSectionResult = await syncSubjectSections(config, options);
    endPhase(
      sectionPhase,
      subjectSectionResult.created +
        subjectSectionResult.updated +
        subjectSectionResult.unchanged
    );

    const setPhase = startPhase(metrics, "Exercise Sets");
    exerciseSetResult = await syncExerciseSets(config, options);
    endPhase(
      setPhase,
      exerciseSetResult.created +
        exerciseSetResult.updated +
        exerciseSetResult.unchanged
    );

    const questionPhase = startPhase(metrics, "Exercise Questions");
    exerciseQuestionResult = await syncExerciseQuestions(config, options);
    endPhase(
      questionPhase,
      exerciseQuestionResult.created +
        exerciseQuestionResult.updated +
        exerciseQuestionResult.unchanged
    );

    const tryoutPhase = startPhase(metrics, "Tryouts");
    tryoutResult = await syncTryouts(config, options);
    endPhase(
      tryoutPhase,
      tryoutResult.created + tryoutResult.updated + tryoutResult.unchanged
    );
  } else {
    const quietOptions = { ...options, quiet: true };

    log("Phase 1: Syncing articles, topics, and sets...");
    const phase1Start = performance.now();
    [articleResult, subjectTopicResult, exerciseSetResult] = await Promise.all([
      syncArticles(config, quietOptions),
      syncSubjectTopics(config, quietOptions),
      syncExerciseSets(config, quietOptions),
    ]);
    log(`  Articles:       ${formatSyncResult(articleResult)}`);
    log(`  Subject Topics: ${formatSyncResult(subjectTopicResult)}`);
    log(`  Exercise Sets:  ${formatSyncResult(exerciseSetResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase1Start)}\n`);

    log("Phase 2: Syncing sections and questions...");
    const phase2Start = performance.now();
    [subjectSectionResult, exerciseQuestionResult] = await Promise.all([
      syncSubjectSections(config, quietOptions),
      syncExerciseQuestions(config, quietOptions),
    ]);
    log(`  Subject Sections:   ${formatSyncResult(subjectSectionResult)}`);
    log(`  Exercise Questions: ${formatSyncResult(exerciseQuestionResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase2Start)}`);

    log("Phase 3: Syncing tryouts...");
    const phase3Start = performance.now();
    tryoutResult = await syncTryouts(config, options);
    log(`  Tryouts:            ${formatSyncResult(tryoutResult)}`);
    log(`  Duration: ${formatDuration(performance.now() - phase3Start)}`);

    addPhaseMetrics(metrics, "Articles", articleResult);
    addPhaseMetrics(metrics, "Subject Topics", subjectTopicResult);
    addPhaseMetrics(metrics, "Subject Sections", subjectSectionResult);
    addPhaseMetrics(metrics, "Exercise Sets", exerciseSetResult);
    addPhaseMetrics(metrics, "Exercise Questions", exerciseQuestionResult);
    addPhaseMetrics(metrics, "Tryouts", tryoutResult);
  }

  finalizeMetrics(metrics);
  logSyncSummary(
    authorResult,
    articleResult,
    subjectTopicResult,
    subjectSectionResult,
    exerciseSetResult,
    exerciseQuestionResult,
    tryoutResult
  );
  logSyncMetrics(metrics);
};

export const syncIncremental = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> => {
  const metrics = createMetrics();
  log("=== INCREMENTAL SYNC ===\n");

  const syncState = loadSyncState(options.prod ?? false);
  const currentCommit = getCurrentGitCommit();

  if (!syncState?.lastSyncCommit) {
    log("No previous sync state found. Running full sync...\n");
    await syncAll(config, options);
    saveSyncState(
      { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
      options.prod ?? false
    );
    return;
  }

  if (!currentCommit) {
    log("Git not available. Running full sync...\n");
    await syncAll(config, options);
    return;
  }

  log(`Last sync: ${new Date(syncState.lastSyncTimestamp).toISOString()}`);
  log(`Last commit: ${syncState.lastSyncCommit.slice(0, 8)}`);
  log(`Current commit: ${currentCommit.slice(0, 8)}\n`);

  if (syncState.lastSyncCommit === currentCommit) {
    logSuccess("No changes since last sync. Nothing to do!");
    finalizeMetrics(metrics);
    logSyncMetrics(metrics);
    return;
  }

  const changedFiles = getChangedFilesSince(syncState.lastSyncCommit);
  if (changedFiles.size === 0) {
    logSuccess("No content files changed. Nothing to do!");
    saveSyncState(
      { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
      options.prod ?? false
    );
    return;
  }

  log(`Changed files: ${changedFiles.size}\n`);
  const changedFilesArray = [...changedFiles];
  const changedAuthorNames =
    await collectAuthorNamesFromFiles(changedFilesArray);

  if (changedAuthorNames.length > 0) {
    log("Phase 0: Pre-syncing authors from changed files...");
    const authorResult = await runConvexMutationGeneric(
      config,
      "contentSync/mutations:bulkSyncAuthors",
      { authorNames: changedAuthorNames },
      AuthorSyncResultSchema
    );
    log(
      `  Authors: ${authorResult.created} new, ${authorResult.existing} existing\n`
    );
  }

  const hasArticleChanges = changedFilesArray.some((file) =>
    file.includes("/articles/")
  );
  const hasSubjectChanges = changedFilesArray.some((file) =>
    file.includes("/subject/")
  );
  const hasExerciseChanges = changedFilesArray.some((file) =>
    file.includes("/exercises/")
  );

  let articleResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let subjectTopicResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let subjectSectionResult: SyncResult = {
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

  if (hasArticleChanges) {
    log("Articles changed - syncing...");
    articleResult = await syncArticles(config, options);
    addPhaseMetrics(metrics, "Articles", articleResult);
  } else {
    log("Articles: no changes");
  }

  if (hasSubjectChanges) {
    log("Subjects changed - syncing...");
    subjectTopicResult = await syncSubjectTopics(config, options);
    subjectSectionResult = await syncSubjectSections(config, options);
    addPhaseMetrics(metrics, "Subject Topics", subjectTopicResult);
    addPhaseMetrics(metrics, "Subject Sections", subjectSectionResult);
  } else {
    log("Subjects: no changes");
  }

  if (hasExerciseChanges) {
    log("Exercises changed - syncing...");
    exerciseSetResult = await syncExerciseSets(config, options);
    exerciseQuestionResult = await syncExerciseQuestions(config, options);
    addPhaseMetrics(metrics, "Exercise Sets", exerciseSetResult);
    addPhaseMetrics(metrics, "Exercise Questions", exerciseQuestionResult);
  } else {
    log("Exercises: no changes");
  }

  finalizeMetrics(metrics);
  log("\n=== SUMMARY ===\n");

  const totalCreated =
    articleResult.created +
    subjectTopicResult.created +
    subjectSectionResult.created +
    exerciseSetResult.created +
    exerciseQuestionResult.created;
  const totalUpdated =
    articleResult.updated +
    subjectTopicResult.updated +
    subjectSectionResult.updated +
    exerciseSetResult.updated +
    exerciseQuestionResult.updated;
  if (totalCreated > 0 || totalUpdated > 0) {
    log(`Changes: ${totalCreated} created, ${totalUpdated} updated`);
  } else {
    log("No changes (all content up to date)");
  }

  logSyncMetrics(metrics);
  saveSyncState(
    { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
    options.prod ?? false
  );
  log("\n=== INCREMENTAL SYNC COMPLETE ===");
  logSuccess("Sync state saved for next incremental sync");
};

export const syncFull = async (
  config: ConvexConfig,
  options: SyncOptions = {}
): Promise<void> => {
  log("=== FULL SYNC ===\n");
  log(
    "This command will: sync all content, clean stale content, verify data\n"
  );

  const currentCommit = getCurrentGitCommit();

  try {
    await syncAll(config, options);
    log("\n");

    const cleanResult = await clean(config, {
      ...options,
      force: true,
      authors: true,
    });
    if (cleanResult.hasStale && cleanResult.deleted) {
      log("\nStale content was found and deleted.");
    }

    log("\n");
    await verify(config, options);
    saveSyncState(
      { lastSyncTimestamp: Date.now(), lastSyncCommit: currentCommit },
      options.prod ?? false
    );

    log("\n=== FULL SYNC COMPLETE ===");
    logSuccess("All operations completed successfully!");
    logSuccess("Sync state saved for incremental syncs");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Full sync failed: ${message}`);
    process.exit(1);
  }
};
