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
  questionChoices: number;
  questionSets: number;
  questions: number;
  quranSurahs: number;
  quranVerses: number;
  tryoutCountries: number;
  tryoutExams: number;
  tryoutSections: number;
  tryoutSets: number;
  tryoutTracks: number;
}

/** Logs the successful verification summary after every integrity gate passes. */
export function logVerifySuccess(counts: VerifySummaryCounts) {
  logSuccess("All primary content synced correctly!");
  log(`  - ${counts.articles} articles`);
  log(`  - ${counts.curriculumTopics} curriculum topics`);
  log(`  - ${counts.curriculumLessons} curriculum lessons`);
  log(`  - ${counts.questionSets} question sets`);
  log(`  - ${counts.questions} questions`);
  log(`  - ${counts.contentSearch} content search rows`);
  log(`  - ${counts.contentRoutes} content route rows`);
  log(`  - ${counts.quranSurahs} Quran surahs`);
  log(`  - ${counts.quranVerses} Quran verses`);
  log(`  - ${counts.tryoutCountries} try-out countries`);
  log(`  - ${counts.tryoutExams} try-out exams`);
  log(`  - ${counts.tryoutTracks} try-out tracks`);
  log(`  - ${counts.tryoutSets} try-out sets`);
  log(`  - ${counts.tryoutSections} try-out sections`);
  log(`  - ${counts.articleReferences} references`);
  log(`  - ${counts.questionChoices} choices`);
  log(`  - ${counts.authors} authors`);
}
