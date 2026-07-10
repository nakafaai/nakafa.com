import { log } from "@repo/backend/scripts/sync-content/cli/logging";
import type { SyncResult } from "@repo/backend/scripts/sync-content/contract/types";

interface AuthorSummary {
  created: number;
}

/**
 * Prints the combined content-sync summary after all source and route-catalog
 * phases complete, preserving the operator-facing grouping used by the CLI.
 */
export function logSyncSummary(
  authorResult: AuthorSummary,
  articleResult: SyncResult,
  curriculumTopicResult: SyncResult,
  curriculumLessonResult: SyncResult,
  quranResult: SyncResult,
  tryoutResult: SyncResult,
  routePageResult: SyncResult,
  publicRouteResult: SyncResult,
  learningProgramResult: SyncResult
): void {
  const totalCreated =
    articleResult.created +
    curriculumTopicResult.created +
    curriculumLessonResult.created +
    quranResult.created +
    tryoutResult.created +
    routePageResult.created +
    publicRouteResult.created +
    learningProgramResult.created;
  const totalUpdated =
    articleResult.updated +
    curriculumTopicResult.updated +
    curriculumLessonResult.updated +
    quranResult.updated +
    tryoutResult.updated +
    routePageResult.updated +
    publicRouteResult.updated +
    learningProgramResult.updated;
  const total =
    totalCreated +
    totalUpdated +
    articleResult.unchanged +
    curriculumTopicResult.unchanged +
    curriculumLessonResult.unchanged +
    quranResult.unchanged +
    tryoutResult.unchanged +
    routePageResult.unchanged +
    publicRouteResult.unchanged +
    learningProgramResult.unchanged;
  const totalAuthorLinksCreated =
    (articleResult.authorLinksCreated || 0) +
    (curriculumLessonResult.authorLinksCreated || 0);

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
    `  Quran:              ${quranResult.created + quranResult.updated + quranResult.unchanged} (${quranResult.created} new, ${quranResult.updated} updated)`
  );
  log(
    `  Tryouts:            ${tryoutResult.created + tryoutResult.updated + tryoutResult.unchanged} (${tryoutResult.created} new, ${tryoutResult.updated} updated)`
  );
  log(
    `  Route Pages:         ${routePageResult.created + routePageResult.updated + routePageResult.unchanged} (${routePageResult.created} new, ${routePageResult.updated} updated)`
  );
  log(
    `  Public Routes:       ${publicRouteResult.created + publicRouteResult.updated + publicRouteResult.unchanged} (${publicRouteResult.created} new, ${publicRouteResult.updated} updated)`
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
