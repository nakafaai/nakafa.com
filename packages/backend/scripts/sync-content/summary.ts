import { log } from "@repo/backend/scripts/sync-content/logging";
import type { SyncResult } from "@repo/backend/scripts/sync-content/types";

interface AuthorSummary {
  created: number;
}

/**
 * Prints the combined content-sync summary after all source and read-model
 * phases complete, preserving the operator-facing grouping used by the CLI.
 */
export function logSyncSummary(
  authorResult: AuthorSummary,
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
): void {
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
    return;
  }

  log("  All content up to date");
}
