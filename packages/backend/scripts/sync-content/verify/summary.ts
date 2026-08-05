import {
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";

interface VerifySummaryCounts {
  articleReferences: number;
  articles: number;
  authors: number;
  contentRoutes: number;
  contentSearch: number;
  curriculumLessons: number;
  curriculumTopics: number;
}

/** Logs the successful verification summary after every integrity gate passes. */
export function logVerifySuccess(counts: VerifySummaryCounts) {
  logSuccess("All primary content synced correctly!");
  log(`  - ${counts.articles} articles`);
  log(`  - ${counts.curriculumTopics} curriculum topics`);
  log(`  - ${counts.curriculumLessons} curriculum lessons`);
  log(`  - ${counts.contentSearch} content search rows`);
  log(`  - ${counts.contentRoutes} content route rows`);
  log(`  - ${counts.articleReferences} references`);
  log(`  - ${counts.authors} authors`);
}
