import {
  formatSyncResult,
  log,
} from "@repo/backend/scripts/sync-content/logging";
import type { SyncResult } from "@repo/backend/scripts/sync-content/types";

/** Logs the final cross-domain content sync summary. */
export function logSyncSummary(args: {
  articleResult: SyncResult;
  authorResult: { created: number };
  exerciseQuestionResult: SyncResult;
  exerciseSetResult: SyncResult;
  quranSearchResult: SyncResult;
  subjectSectionResult: SyncResult;
  subjectTopicResult: SyncResult;
  tryoutResult: SyncResult;
}) {
  const totalCreated =
    args.articleResult.created +
    args.subjectTopicResult.created +
    args.subjectSectionResult.created +
    args.exerciseSetResult.created +
    args.exerciseQuestionResult.created +
    args.quranSearchResult.created +
    args.tryoutResult.created;
  const totalUpdated =
    args.articleResult.updated +
    args.subjectTopicResult.updated +
    args.subjectSectionResult.updated +
    args.exerciseSetResult.updated +
    args.exerciseQuestionResult.updated +
    args.quranSearchResult.updated +
    args.tryoutResult.updated;
  const total =
    totalCreated +
    totalUpdated +
    args.articleResult.unchanged +
    args.subjectTopicResult.unchanged +
    args.subjectSectionResult.unchanged +
    args.exerciseSetResult.unchanged +
    args.exerciseQuestionResult.unchanged +
    args.quranSearchResult.unchanged +
    args.tryoutResult.unchanged;
  const totalAuthorLinksCreated =
    (args.articleResult.authorLinksCreated || 0) +
    (args.subjectSectionResult.authorLinksCreated || 0) +
    (args.exerciseQuestionResult.authorLinksCreated || 0);

  log("\n=== SYNC SUMMARY ===\n");
  log("Primary Content:");
  log(`  Articles:           ${formatSyncResult(args.articleResult)}`);
  log(`  Subject Topics:     ${formatSyncResult(args.subjectTopicResult)}`);
  log(`  Subject Sections:   ${formatSyncResult(args.subjectSectionResult)}`);
  log(`  Exercise Sets:      ${formatSyncResult(args.exerciseSetResult)}`);
  log(`  Exercise Questions: ${formatSyncResult(args.exerciseQuestionResult)}`);
  log(`  Quran Search:       ${formatSyncResult(args.quranSearchResult)}`);
  log(`  Tryouts:            ${formatSyncResult(args.tryoutResult)}`);

  log("\nRelated Items:");
  if (args.authorResult.created > 0) {
    log(`  Authors:              ${args.authorResult.created} new`);
  }
  if ((args.articleResult.referencesCreated || 0) > 0) {
    log(`  Article References:   ${args.articleResult.referencesCreated || 0}`);
  }
  if ((args.exerciseQuestionResult.choicesCreated || 0) > 0) {
    log(
      `  Exercise Choices:     ${args.exerciseQuestionResult.choicesCreated || 0}`
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
