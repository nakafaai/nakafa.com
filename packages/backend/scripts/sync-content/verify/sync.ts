import {
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import {
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { getContentCounts } from "@repo/backend/scripts/sync-content/convex/counts";
import { getDataIntegrity } from "@repo/backend/scripts/sync-content/convex/inspection";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime/files";
import { verifyGraphIdentity } from "@repo/backend/scripts/sync-content/verify/graph";
import { verifyQuranRuntime } from "@repo/backend/scripts/sync-content/verify/quran";
import { logVerifySuccess } from "@repo/backend/scripts/sync-content/verify/summary";
import { readQuranMetadata } from "@repo/contents/_lib/quran";
import {
  listLessonMaterialSources,
  listLessonRows,
} from "@repo/contents/_types/material/registry";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

const logIntegrityList = (
  title: string,
  items: readonly string[],
  successMessage: string
) => {
  if (items.length === 0) {
    logSuccess(successMessage);
    return false;
  }

  logError(`${items.length} ${title}:`);
  for (const item of items.slice(0, 5)) {
    log(`  - ${item}`);
  }
  if (items.length > 5) {
    log(`  ... and ${items.length - 5} more`);
  }
  return true;
};

function logCountMatch({
  actual,
  expected,
  label,
}: {
  actual: number;
  expected: number;
  label: string;
}) {
  if (actual === expected) {
    logSuccess(`${label}: ${actual} = ${expected} expected`);
    return true;
  }

  logError(`${label}: ${actual} != ${expected} expected`);
  return false;
}

function getExpectedQuranCounts() {
  return readQuranMetadata().pipe(
    Effect.map((surahs) => ({
      surahs: surahs.length,
      verses: surahs.reduce((total, surah) => total + surah.numberOfVerses, 0),
    }))
  );
}

function getExpectedCurriculumCounts() {
  const materialTopics = listLessonRows();

  return {
    curriculumLessons: materialTopics.reduce(
      (total, topic) => total + topic.sections.length,
      0
    ),
    curriculumTopics: materialTopics.length,
  };
}

/** Verifies Nakafa-owned filesystem content against its Convex read models. */
export const verify = Effect.fn("sync.verify")(function* (
  config: ConvexConfig,
  options: SyncOptions = {}
) {
  log("=== VERIFY CONTENT ===\n");

  const [articleFiles, lessonFiles, refFiles] = yield* Effect.all([
    globFiles("articles/**/*.mdx"),
    globFiles("material/lesson/**/*.mdx"),
    globFiles("articles/**/ref.ts"),
  ]);
  const lessonSourceCount = listLessonMaterialSources().length;
  const expectedCurriculumCounts = getExpectedCurriculumCounts();

  log("=== FILESYSTEM ===\n");
  log("Articles:");
  log(`  Total MDX files:     ${articleFiles.length}`);
  for (const locale of locales) {
    const count = articleFiles.filter((file) =>
      file.endsWith(`/${locale}.mdx`)
    ).length;
    log(`    - ${locale}: ${count}`);
  }
  log(`  Reference files:     ${refFiles.length} (ref.ts)`);

  log("\nCurriculum:");
  log(`  Material sources:    ${lessonSourceCount}`);
  log(`  Total MDX files:     ${lessonFiles.length}`);
  for (const locale of locales) {
    const count = lessonFiles.filter((file) =>
      file.endsWith(`/${locale}.mdx`)
    ).length;
    log(`    - ${locale}: ${count}`);
  }

  const countsResult = yield* Effect.either(getContentCounts(config));
  if (countsResult._tag === "Left") {
    return yield* new ScriptFailureError({
      message: `Failed to query database: ${getUnknownMessage(countsResult.left)}`,
    });
  }

  const counts = countsResult.right;
  const expectedQuranCounts = yield* getExpectedQuranCounts();
  log("\n=== DATABASE ===\n");
  log(`  articleContents:     ${counts.articles}`);
  log(`  curriculumTopics:    ${counts.curriculumTopics}`);
  log(`  curriculumLessons:   ${counts.curriculumLessons}`);
  log(`  contentSearch:       ${counts.contentSearch}`);
  log(`  contentRoutes:       ${counts.contentRoutes}`);
  log(`  publicRoutes:        ${counts.publicRoutes}`);
  log(`  quranSurahs:         ${counts.quranSurahs}`);
  log(`  quranVerses:         ${counts.quranVerses}`);

  log("\n=== VERIFICATION ===\n");
  let allMatch = logCountMatch({
    actual: counts.articles,
    expected: articleFiles.length,
    label: "Articles",
  });
  allMatch =
    logCountMatch({
      actual: counts.curriculumTopics,
      expected: expectedCurriculumCounts.curriculumTopics,
      label: "Curriculum Topics",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: counts.curriculumLessons,
      expected: expectedCurriculumCounts.curriculumLessons,
      label: "Curriculum Lessons",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: counts.quranSurahs,
      expected: expectedQuranCounts.surahs,
      label: "Quran Surahs",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: counts.quranVerses,
      expected: expectedQuranCounts.verses,
      label: "Quran Verses",
    }) && allMatch;

  log(
    `References: ${counts.articleReferences} in DB from ${refFiles.length} ref.ts files across ${locales.length} locales`
  );
  log(`Content-author links: ${counts.contentAuthors} in DB`);

  log("\n=== DATA INTEGRITY ===\n");
  const integrityResult = yield* Effect.either(getDataIntegrity(config));
  if (integrityResult._tag === "Left") {
    return yield* new ScriptFailureError({
      message: `Failed to query database: ${getUnknownMessage(integrityResult.left)}`,
    });
  }

  const integrity = integrityResult.right;
  allMatch =
    !logIntegrityList(
      "sections without topics",
      integrity.sectionsWithoutTopics,
      `All ${integrity.totalSections} sections have topics`
    ) && allMatch;
  const articlesWithRefs =
    integrity.totalArticles - integrity.articlesWithoutReferences.length;
  log(
    `Articles with references: ${articlesWithRefs}/${integrity.totalArticles}`
  );

  log("\n=== GRAPH IDENTITY ===\n");
  const graphIdentityResult = yield* Effect.either(verifyGraphIdentity(config));
  if (graphIdentityResult._tag === "Left") {
    return yield* new ScriptFailureError({
      message: `Failed to verify graph identity: ${getUnknownMessage(graphIdentityResult.left)}`,
    });
  }
  allMatch = graphIdentityResult.right && allMatch;

  log("\n=== QURAN RUNTIME ===\n");
  const quranRuntimeResult = yield* Effect.either(
    verifyQuranRuntime(config, options)
  );
  if (quranRuntimeResult._tag === "Left") {
    return yield* new ScriptFailureError({
      message: `Failed to verify Quran runtime: ${getUnknownMessage(quranRuntimeResult.left)}`,
    });
  }
  allMatch = quranRuntimeResult.right && allMatch;

  log("\n=== SUMMARY ===\n");
  if (allMatch) {
    logVerifySuccess(counts);
    return;
  }

  logError("Content mismatch detected!");
  return yield* new ScriptFailureError({
    message: "Content verification failed.",
  });
});
