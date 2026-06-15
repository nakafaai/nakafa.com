import { internal } from "@repo/backend/convex/_generated/api";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import {
  formatDuration,
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/logging";
import { clearSyncState } from "@repo/backend/scripts/sync-content/runtime";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type BatchDeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number; hasMore: boolean }
>;

/** One bounded Convex table reset step in the full content reset sequence. */
interface ResetStep {
  label: string;
  mutation: BatchDeleteMutation;
  resultLabel: string;
}

const RESET_STEPS: ResetStep[] = [
  {
    label: "Deleting content search rows...",
    mutation: internal.contentSync.reset.internal.deleteContentSearchBatch,
    resultLabel: "content search rows",
  },
  {
    label: "Deleting content view analytics queue...",
    mutation:
      internal.contentSync.reset.internal.deleteContentViewAnalyticsQueueBatch,
    resultLabel: "content view analytics queue rows",
  },
  {
    label: "Deleting content analytics partition leases...",
    mutation:
      internal.contentSync.reset.internal.deleteContentAnalyticsPartitionsBatch,
    resultLabel: "content analytics partition leases",
  },
  {
    label: "Deleting content view rows...",
    mutation: internal.contentSync.reset.internal.deleteContentViewsBatch,
    resultLabel: "content view rows",
  },
  {
    label: "Deleting learning popularity rows...",
    mutation: internal.contentSync.reset.internal.deleteLearningPopularityBatch,
    resultLabel: "learning popularity rows",
  },
  {
    label: "Deleting learning trending bucket rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningTrendingBucketsBatch,
    resultLabel: "learning trending bucket rows",
  },
  {
    label: "Deleting learning program coverage rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningProgramCoverageBatch,
    resultLabel: "learning program coverage rows",
  },
  {
    label: "Deleting content route rows...",
    mutation: internal.contentSync.reset.internal.deleteContentRoutesBatch,
    resultLabel: "content route rows",
  },
  {
    label: "Deleting content route count rows...",
    mutation: internal.contentSync.reset.internal.deleteContentRouteCountsBatch,
    resultLabel: "content route count rows",
  },
  {
    label: "Deleting content route artifact pages...",
    mutation: internal.contentSync.reset.internal.deleteContentRoutePagesBatch,
    resultLabel: "content route artifact pages",
  },
  {
    label: "Deleting Quran verses...",
    mutation: internal.contentSync.reset.internal.deleteQuranVersesBatch,
    resultLabel: "Quran verses",
  },
  {
    label: "Deleting Quran surahs...",
    mutation: internal.contentSync.reset.internal.deleteQuranSurahsBatch,
    resultLabel: "Quran surahs",
  },
  {
    label: "Deleting content authors...",
    mutation: internal.contentSync.reset.internal.deleteContentAuthorsBatch,
    resultLabel: "content authors",
  },
  {
    label: "Deleting article references...",
    mutation: internal.contentSync.reset.internal.deleteArticleReferencesBatch,
    resultLabel: "article references",
  },
  {
    label: "Deleting exercise choices...",
    mutation: internal.contentSync.reset.internal.deleteExerciseChoicesBatch,
    resultLabel: "exercise choices",
  },
  {
    label: "Deleting exercise answers...",
    mutation: internal.contentSync.reset.internal.deleteExerciseAnswersBatch,
    resultLabel: "exercise answers",
  },
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
  {
    label: "Deleting tryout part attempts...",
    mutation: internal.contentSync.reset.internal.deleteTryoutPartAttemptsBatch,
    resultLabel: "tryout part attempts",
  },
  {
    label: "Deleting tryout leaderboard entries...",
    mutation:
      internal.contentSync.reset.internal.deleteTryoutLeaderboardEntriesBatch,
    resultLabel: "tryout leaderboard entries",
  },
  {
    label: "Deleting user tryout stats...",
    mutation: internal.contentSync.reset.internal.deleteUserTryoutStatsBatch,
    resultLabel: "user tryout stats",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtScalePublicationQueueBatch,
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale version items...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtScaleVersionItemsBatch,
    resultLabel: "IRT scale version items",
  },
  {
    label: "Deleting exercise item parameters...",
    mutation:
      internal.contentSync.reset.internal.deleteExerciseItemParametersBatch,
    resultLabel: "exercise item parameters",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtScaleQualityChecksBatch,
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutation:
      internal.contentSync.reset.internal
        .deleteIrtScaleQualityRefreshQueueBatch,
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtCalibrationQueueBatch,
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtCalibrationAttemptsBatch,
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtCalibrationCacheStatsBatch,
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting exercise attempts...",
    mutation: internal.contentSync.reset.internal.deleteExerciseAttemptsBatch,
    resultLabel: "exercise attempts",
  },
  {
    label: "Deleting tryout attempts...",
    mutation: internal.contentSync.reset.internal.deleteTryoutAttemptsBatch,
    resultLabel: "tryout attempts",
  },
  {
    label: "Deleting tryout entitlements...",
    mutation: internal.contentSync.reset.internal.deleteTryoutEntitlementsBatch,
    resultLabel: "tryout entitlements",
  },
  {
    label: "Deleting tryout access grants...",
    mutation: internal.contentSync.reset.internal.deleteTryoutAccessGrantsBatch,
    resultLabel: "tryout access grants",
  },
  {
    label: "Deleting tryout access campaign products...",
    mutation:
      internal.contentSync.reset.internal
        .deleteTryoutAccessCampaignProductsBatch,
    resultLabel: "tryout access campaign products",
  },
  {
    label: "Deleting tryout access links...",
    mutation: internal.contentSync.reset.internal.deleteTryoutAccessLinksBatch,
    resultLabel: "tryout access links",
  },
  {
    label: "Deleting tryout access campaigns...",
    mutation:
      internal.contentSync.reset.internal.deleteTryoutAccessCampaignsBatch,
    resultLabel: "tryout access campaigns",
  },
  {
    label: "Deleting tryout catalog meta...",
    mutation: internal.contentSync.reset.internal.deleteTryoutCatalogMetaBatch,
    resultLabel: "tryout catalog meta rows",
  },
  {
    label: "Deleting tryout part sets...",
    mutation: internal.contentSync.reset.internal.deleteTryoutPartSetsBatch,
    resultLabel: "tryout part sets",
  },
  {
    label: "Deleting IRT scale versions...",
    mutation: internal.contentSync.reset.internal.deleteIrtScaleVersionsBatch,
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutation: internal.contentSync.reset.internal.deleteIrtCalibrationRunsBatch,
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting tryouts...",
    mutation: internal.contentSync.reset.internal.deleteTryoutsBatch,
    resultLabel: "tryouts",
  },
  {
    label: "Deleting exercise questions...",
    mutation: internal.contentSync.reset.internal.deleteExerciseQuestionsBatch,
    resultLabel: "exercise questions",
  },
  {
    label: "Deleting subject sections...",
    mutation: internal.contentSync.reset.internal.deleteSubjectSectionsBatch,
    resultLabel: "subject sections",
  },
  {
    label: "Deleting exercise sets...",
    mutation: internal.contentSync.reset.internal.deleteExerciseSetsBatch,
    resultLabel: "exercise sets",
  },
  {
    label: "Deleting subject topics...",
    mutation: internal.contentSync.reset.internal.deleteSubjectTopicsBatch,
    resultLabel: "subject topics",
  },
  {
    label: "Deleting articles...",
    mutation: internal.contentSync.reset.internal.deleteArticlesBatch,
    resultLabel: "articles",
  },
];

/** Deletes every row exposed by one bounded reset mutation. */
const deleteAllBatched = Effect.fn("sync.reset.deleteAllBatched")(function* (
  config: ConvexConfig,
  mutation: BatchDeleteMutation,
  label: string
) {
  let totalDeleted = 0;
  let batchNum = 1;
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

    if (result.deleted > 0) {
      yield* Effect.sync(() =>
        process.stdout.write(
          `\r  Batch ${batchNum}: deleted ${totalDeleted} ${label}...`
        )
      );
      batchNum++;
    }
  }

  if (totalDeleted > 0) {
    yield* Effect.sync(() => process.stdout.write("\n"));
  }
  return totalDeleted;
});

/** Deletes the full sync-managed content graph and its derived runtime rows. */
export const reset = Effect.fn("sync.reset")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== RESET CONTENT ===\n");
  log(
    "This will DELETE synced content and the runtime data derived from it.\n"
  );

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning("This will permanently delete all content from production.\n");
  }
  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  log("Current database contents:\n");
  const counts = yield* getContentCounts(config);

  log(`  Content Search:        ${counts.contentSearch}`);
  log(`  Content Views:         ${counts.contentViews}`);
  log(`  View Analytics Queue:  ${counts.contentViewAnalyticsQueue}`);
  log(`  Analytics Partitions:  ${counts.contentAnalyticsPartitions}`);
  log(`  Learning Popularity:   ${counts.learningPopularity}`);
  log(`  Learning Trending:     ${counts.learningTrendingBuckets}`);
  log(`  Learning Programs:     ${counts.learningPrograms}`);
  log(`  Learning Program Srcs: ${counts.learningProgramSources}`);
  log(`  Learning Program Cov:  ${counts.learningProgramCoverage}`);
  log(`  Content Routes:        ${counts.contentRoutes}`);
  log(`  Content Route Counts:  ${counts.contentRouteCounts}`);
  log(`  Content Route Pages:   ${counts.contentRoutePages}`);
  log(`  Quran Surahs:          ${counts.quranSurahs}`);
  log(`  Quran Verses:          ${counts.quranVerses}`);
  log(`  Content Authors:       ${counts.contentAuthors}`);
  log(`  Article References:    ${counts.articleReferences}`);
  log(`  Exercise Choices:      ${counts.exerciseChoices}`);
  log(`  Audio Content Sources: ${counts.audioContentSources}`);
  log(`  Content Audios:        ${counts.contentAudios}`);
  log(`  Audio Queue:           ${counts.audioGenerationQueue}`);
  log(`  Exercise Answers:      ${counts.exerciseAnswers}`);
  log(`  Exercise Questions:    ${counts.exerciseQuestions}`);
  log(`  Exercise Attempts:     ${counts.exerciseAttempts}`);
  log(`  Exercise Sets:         ${counts.exerciseSets}`);
  log(`  Tryout Access Campaigns:${counts.tryoutAccessCampaigns}`);
  log(`  Tryout Access Products: ${counts.tryoutAccessCampaignProducts}`);
  log(`  Tryout Access Links:    ${counts.tryoutAccessLinks}`);
  log(`  Tryout Access Grants:   ${counts.tryoutAccessGrants}`);
  log(`  Tryouts:               ${counts.tryouts}`);
  log(`  Tryout Catalog Meta:   ${counts.tryoutCatalogMeta}`);
  log(`  User Entitlements:     ${counts.userTryoutEntitlements}`);
  log(`  Tryout Part Sets:      ${counts.tryoutPartSets}`);
  log(`  Tryout Attempts:       ${counts.tryoutAttempts}`);
  log(`  Tryout Part Attempts:  ${counts.tryoutPartAttempts}`);
  log(`  Tryout Leaderboard:    ${counts.tryoutLeaderboardEntries}`);
  log(`  User Tryout Stats:     ${counts.userTryoutStats}`);
  log(`  IRT Calibration Queue: ${counts.irtCalibrationQueue}`);
  log(`  IRT Calibration Rows:  ${counts.irtCalibrationAttempts}`);
  log(`  IRT Cache Stats:       ${counts.irtCalibrationCacheStats}`);
  log(`  IRT Calibration Runs:  ${counts.irtCalibrationRuns}`);
  log(`  IRT Scale Quality:     ${counts.irtScaleQualityChecks}`);
  log(`  IRT Scale Quality Q:   ${counts.irtScaleQualityRefreshQueue}`);
  log(`  IRT Item Params:       ${counts.exerciseItemParameters}`);
  log(`  IRT Scale Queue:       ${counts.irtScalePublicationQueue}`);
  log(`  IRT Scale Versions:    ${counts.irtScaleVersions}`);
  log(`  IRT Scale Items:       ${counts.irtScaleVersionItems}`);
  log(`  Subject Sections:      ${counts.subjectSections}`);
  log(`  Subject Topics:        ${counts.subjectTopics}`);
  log(`  Articles:              ${counts.articles}`);
  log(`  Authors:               ${counts.authors}`);

  const totalContent =
    counts.articles +
    counts.subjectTopics +
    counts.subjectSections +
    counts.exerciseSets +
    counts.exerciseQuestions;
  const totalRelated =
    counts.contentAuthors +
    counts.articleReferences +
    counts.exerciseChoices +
    counts.exerciseAnswers;
  const totalRuntime =
    counts.exerciseAttempts +
    counts.audioGenerationQueue +
    counts.tryoutAccessCampaigns +
    counts.tryoutAccessCampaignProducts +
    counts.tryoutAccessLinks +
    counts.tryoutAccessGrants +
    counts.tryouts +
    counts.tryoutCatalogMeta +
    counts.userTryoutEntitlements +
    counts.tryoutPartSets +
    counts.tryoutAttempts +
    counts.tryoutPartAttempts +
    counts.tryoutLeaderboardEntries +
    counts.userTryoutStats +
    counts.irtCalibrationQueue +
    counts.irtCalibrationAttempts +
    counts.irtCalibrationCacheStats +
    counts.irtCalibrationRuns +
    counts.irtScaleQualityChecks +
    counts.irtScaleQualityRefreshQueue +
    counts.exerciseItemParameters +
    counts.irtScalePublicationQueue +
    counts.irtScaleVersions +
    counts.irtScaleVersionItems;
  const totalDerived =
    counts.contentSearch +
    counts.contentViews +
    counts.contentViewAnalyticsQueue +
    counts.contentAnalyticsPartitions +
    counts.learningPopularity +
    counts.learningTrendingBuckets +
    counts.learningProgramCoverage +
    counts.contentRoutes +
    counts.contentRouteCounts +
    counts.contentRoutePages +
    counts.quranSurahs +
    counts.quranVerses +
    counts.audioContentSources +
    counts.contentAudios;
  const preservedProgramCatalog =
    counts.learningPrograms + counts.learningProgramSources;

  log(`\n  Total content items:  ${totalContent}`);
  log(`  Total related items:  ${totalRelated}`);
  log(`  Total runtime items:  ${totalRuntime}`);
  log(`  Total derived items:  ${totalDerived}`);
  log(`  Preserved program catalog rows: ${preservedProgramCatalog}`);

  if (
    totalContent === 0 &&
    totalRelated === 0 &&
    totalRuntime === 0 &&
    totalDerived === 0
  ) {
    logSuccess("\nReset-managed content is already empty. Nothing to delete.");
    return;
  }

  if (!options.force) {
    log("\nTo delete all content, run:");
    if (options.prod) {
      log("  pnpm --filter @repo/backend sync:reset --prod --force");
    } else {
      log("  pnpm --filter @repo/backend sync:reset --force");
    }
    if (!options.authors) {
      log("\nTo also delete authors, add --authors flag");
    }
    return;
  }

  log("\nDeleting content (in dependency order)...\n");
  const startTime = performance.now();
  let totalDeleted = 0;

  for (const [index, step] of RESET_STEPS.entries()) {
    log(`${index + 1}/${RESET_STEPS.length} ${step.label}`);
    const deleted = yield* deleteAllBatched(
      config,
      step.mutation,
      step.resultLabel
    );
    logSuccess(`  Deleted ${deleted} ${step.resultLabel}`);
    totalDeleted += deleted;
  }

  if (options.authors) {
    log("Deleting authors...");
    const authorsDeleted = yield* deleteAllBatched(
      config,
      internal.contentSync.reset.internal.deleteAuthorsBatch,
      "authors"
    );
    logSuccess(`  Deleted ${authorsDeleted} authors`);
    totalDeleted += authorsDeleted;
  } else {
    log("Skipping authors (use --authors to include)");
  }

  log("\n=== RESET COMPLETE ===\n");
  logSuccess(
    `Deleted ${totalDeleted} items in ${formatDuration(performance.now() - startTime)}`
  );
  yield* clearSyncState(options.prod ?? false);
  log("Cleared sync state file");

  log("\nTo re-sync content, run:");
  if (options.prod) {
    log("  pnpm --filter @repo/backend sync:prod");
  } else {
    log("  pnpm --filter @repo/backend sync");
  }
});
