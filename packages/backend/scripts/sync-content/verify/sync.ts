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
import {
  getDataIntegrity,
  getGraphIdentityIntegrity,
} from "@repo/backend/scripts/sync-content/convex/inspection";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime/files";
import { verifyQuranRuntime } from "@repo/backend/scripts/sync-content/verify/quran";
import { logVerifySuccess } from "@repo/backend/scripts/sync-content/verify/summary";
import { getAllSurah } from "@repo/contents/_lib/quran";
import {
  listLessonMaterialSources,
  listLessonRows,
} from "@repo/contents/_types/material/registry";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

/** Logs a bounded integrity sample and reports whether the verifier found issues. */
const logIntegrityList = (
  title: string,
  items: readonly string[],
  successMessage: string
): boolean => {
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

/** Logs one equality check and returns whether it matched. */
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
    logSuccess(`${label}: ${actual} in DB = ${expected} expected`);
    return true;
  }

  logError(`${label}: ${actual} in DB != ${expected} expected`);
  return false;
}

/** Builds the Quran count targets from the content authoring source. */
function getExpectedQuranCounts() {
  const surahs = getAllSurah();
  return {
    surahs: surahs.length,
    verses: surahs.reduce((total, surah) => total + surah.numberOfVerses, 0),
  };
}

/** Builds final read-model count targets from typed material and curriculum sources. */
const getExpectedGeneratedCounts = Effect.fn("sync.expectedGeneratedCounts")(
  function* (options: SyncOptions) {
    const materialTopics = listLessonRows(options.locale);

    return {
      curriculumLessons: materialTopics.reduce(
        (total, topic) => total + topic.sections.length,
        0
      ),
      curriculumTopics: materialTopics.length,
      materialLocales: getExpectedLessonMaterialLocales(options),
    };
  }
);

/**
 * Counts lesson material locale rows from source-authored sections so verify
 * compares Convex against the same projection inputs used by sync.
 */
function getExpectedLessonMaterialLocales(options: SyncOptions) {
  const localeCount = getExpectedLocaleCount(options);

  return listLessonMaterialSources().reduce(
    (total, material) => total + material.sections.length * localeCount,
    0
  );
}

/** Counts the locales a verify run should expect after optional locale scoping. */
function getExpectedLocaleCount(options: SyncOptions) {
  return options.locale ? 1 : locales.length;
}

/** Builds try-out question-bank count targets from active source placements. */
function getExpectedTryoutCounts(options: SyncOptions) {
  const localeCount = getExpectedLocaleCount(options);
  let questionSourceDirectories = 0;
  let questionSetPlacements = 0;

  for (const source of TRYOUT_SOURCES) {
    for (const set of source.sets) {
      for (const section of set.sections) {
        questionSetPlacements += 1;
        questionSourceDirectories += section.questionCount;
      }
    }
  }

  return {
    localizedQuestionFiles: questionSourceDirectories * localeCount,
    localizedQuestionSets: questionSetPlacements * localeCount,
    questionSourceDirectories,
  };
}

/** Result shape returned by the persisted graph identity integrity check. */
type GraphIdentityIntegrity = Effect.Effect.Success<
  ReturnType<typeof getGraphIdentityIntegrity>
>;

/** Logs graph identity integrity gates and returns whether all gates passed. */
function logGraphIdentityIntegrity(graphIdentity: GraphIdentityIntegrity) {
  let allMatch = true;

  log(
    `Checked ${graphIdentity.checkedRefs} graph refs and ${graphIdentity.checkedRefInputs} Nakafa content_ref inputs across ${graphIdentity.scannedRows} persisted rows`
  );

  if (graphIdentity.missingGraphRows === 0) {
    logSuccess("All persisted content refs include graph identity fields");
  } else {
    logError(
      `${graphIdentity.missingGraphRows} persisted content refs are missing graph identity fields`
    );
    if (graphIdentity.firstMissingGraph) {
      log(
        `  First missing graph ref: ${JSON.stringify(graphIdentity.firstMissingGraph)}`
      );
    }
    allMatch = false;
  }

  if (graphIdentity.routeShapedContentIds === 0) {
    logSuccess("No persisted content refs use route-shaped content_id values");
  } else {
    logError(
      `${graphIdentity.routeShapedContentIds} persisted content refs still use route-shaped content_id values`
    );
    if (graphIdentity.firstRouteShapedContentId) {
      log(
        `  First route-shaped content_id: ${JSON.stringify(graphIdentity.firstRouteShapedContentId)}`
      );
    }
    allMatch = false;
  }

  if (graphIdentity.invalidRefInputs === 0) {
    logSuccess(
      "All persisted Nakafa content_ref inputs use graph IDs, resource URIs, or canonical URLs"
    );
  } else {
    logError(
      `${graphIdentity.invalidRefInputs} persisted Nakafa content_ref inputs are invalid`
    );
    if (graphIdentity.firstInvalidRefInput) {
      log(
        `  First invalid content_ref input: ${JSON.stringify(graphIdentity.firstInvalidRefInput)}`
      );
    }
    allMatch = false;
  }

  if (graphIdentity.mismatchedContentIds === 0) {
    logSuccess("All persisted content refs use assetId as content_id");
  } else {
    logError(
      `${graphIdentity.mismatchedContentIds} persisted content refs have content_id values that differ from assetId`
    );
    if (graphIdentity.firstMismatchedContentId) {
      log(
        `  First mismatched content_id: ${JSON.stringify(graphIdentity.firstMismatchedContentId)}`
      );
    }
    allMatch = false;
  }

  return allMatch;
}

/** Verifies filesystem content counts against Convex read models. */
export const verify = Effect.fn("sync.verify")(function* (
  config: ConvexConfig,
  options: SyncOptions = {}
) {
  log("=== VERIFY CONTENT ===\n");

  const [
    articleFiles,
    lessonFiles,
    questionFiles,
    answerFiles,
    choicesFiles,
    refFiles,
  ] = yield* Effect.all([
    globFiles("articles/**/*.mdx"),
    globFiles("material/lesson/**/*.mdx"),
    globFiles("question-bank/tryout/**/question.*.mdx"),
    globFiles("question-bank/tryout/**/answer.*.mdx"),
    globFiles("question-bank/tryout/**/choices.ts"),
    globFiles("articles/**/ref.ts"),
  ]);

  const articleFilesEn = articleFiles.filter((file) =>
    file.endsWith("/en.mdx")
  );
  const articleFilesId = articleFiles.filter((file) =>
    file.endsWith("/id.mdx")
  );
  const lessonFilesEn = lessonFiles.filter((file) => file.endsWith("/en.mdx"));
  const lessonFilesId = lessonFiles.filter((file) => file.endsWith("/id.mdx"));
  const questionFilesEn = questionFiles.filter((file) =>
    file.endsWith(".en.mdx")
  );
  const questionFilesId = questionFiles.filter((file) =>
    file.endsWith(".id.mdx")
  );
  const lessonSourceCount = listLessonMaterialSources().length;
  const tryoutSourceCount = TRYOUT_SOURCES.length;
  const expectedGeneratedCounts = yield* getExpectedGeneratedCounts(options);
  const expectedTryoutCounts = getExpectedTryoutCounts(options);

  log("=== FILESYSTEM ===\n");
  log("Articles:");
  log(`  Total MDX files:     ${articleFiles.length}`);
  log(`    - English (en):    ${articleFilesEn.length}`);
  log(`    - Indonesian (id): ${articleFilesId.length}`);
  log(`  Reference files:     ${refFiles.length} (ref.ts)`);

  log("\nCurriculum:");
  log(`  Material sources:        ${lessonSourceCount}`);
  log(`  Total MDX files:     ${lessonFiles.length}`);
  log(`    - English (en):    ${lessonFilesEn.length}`);
  log(`    - Indonesian (id): ${lessonFilesId.length}`);

  log("\nTry-Out Question Bank:");
  log(`  Try-out sources:     ${tryoutSourceCount}`);
  log(`  Question files:      ${questionFiles.length} (question.*.mdx)`);
  log(`    - English (en):    ${questionFilesEn.length}`);
  log(`    - Indonesian (id): ${questionFilesId.length}`);
  log(`  Answer files:        ${answerFiles.length} (answer.*.mdx)`);
  log(`  Choices files:       ${choicesFiles.length} (choices.ts)`);

  log("\n=== DATABASE ===\n");

  const countsResult = yield* Effect.either(getContentCounts(config));
  if (countsResult._tag === "Left") {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Failed to query database: ${getUnknownMessage(countsResult.left)}`,
      })
    );
  }

  const counts = countsResult.right;
  const expectedQuranCounts = getExpectedQuranCounts();

  log("Content tables:");
  log(`  articleContents:     ${counts.articles}`);
  log(`  materials:           ${counts.materials}`);
  log(`  materialLocales:     ${counts.materialLocales}`);
  log(`  curricula:           ${counts.curricula}`);
  log(`  curriculumNodes:     ${counts.curriculumNodes}`);
  log(`  curriculumMaterials: ${counts.curriculumMaterials}`);
  log(`  assessments:         ${counts.assessments}`);
  log(`  assessmentNodes:     ${counts.assessmentNodes}`);
  log(`  curriculumTopics:       ${counts.curriculumTopics}`);
  log(`  curriculumLessons:     ${counts.curriculumLessons}`);
  log(`  questionSets:        ${counts.questionSets}`);
  log(`  questions:           ${counts.questions}`);
  log(`  questionChoices:     ${counts.questionChoices}`);
  log(`  contentSearch:       ${counts.contentSearch}`);
  log(`  contentRoutes:       ${counts.contentRoutes}`);
  log(`  learningPrograms:    ${counts.learningPrograms}`);
  log(`  learningProgramSrcs: ${counts.learningProgramSources}`);
  log(`  learningProgramCov:  ${counts.learningProgramCoverage}`);
  log(`  quranSurahs:         ${counts.quranSurahs}`);
  log(`  quranVerses:         ${counts.quranVerses}`);
  log(`  tryoutCountries:     ${counts.tryoutCountries}`);
  log(`  tryoutExams:         ${counts.tryoutExams}`);
  log(`  tryoutSets:          ${counts.tryoutSets}`);
  log(`  tryoutSections:      ${counts.tryoutSections}`);

  log("\nRelated tables:");
  log(`  authors:             ${counts.authors}`);
  log(`  contentAuthors:      ${counts.contentAuthors} (content-author links)`);
  log(`  articleReferences:   ${counts.articleReferences}`);

  log("\n=== VERIFICATION ===\n");

  let allMatch = true;

  if (counts.articles === articleFiles.length) {
    logSuccess(
      `Articles: ${counts.articles} in DB = ${articleFiles.length} files`
    );
  } else {
    logError(
      `Articles: ${counts.articles} in DB != ${articleFiles.length} files`
    );
    allMatch = false;
  }

  allMatch =
    logCountMatch({
      actual: counts.materialLocales,
      expected: expectedGeneratedCounts.materialLocales,
      label: "Material Locales",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: counts.curriculumTopics,
      expected: expectedGeneratedCounts.curriculumTopics,
      label: "Curriculum Topics",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: counts.curriculumLessons,
      expected: expectedGeneratedCounts.curriculumLessons,
      label: "Curriculum Lessons",
    }) && allMatch;

  allMatch =
    logCountMatch({
      actual: questionFiles.length,
      expected: expectedTryoutCounts.localizedQuestionFiles,
      label: "Question Files",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: answerFiles.length,
      expected: expectedTryoutCounts.localizedQuestionFiles,
      label: "Answer Files",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: choicesFiles.length,
      expected: expectedTryoutCounts.questionSourceDirectories,
      label: "Choices Files",
    }) && allMatch;
  allMatch =
    logCountMatch({
      actual: counts.questions,
      expected: expectedTryoutCounts.localizedQuestionFiles,
      label: "Questions",
    }) && allMatch;

  allMatch =
    logCountMatch({
      actual: counts.questionSets,
      expected: expectedTryoutCounts.localizedQuestionSets,
      label: "Question Sets",
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
    `\nReferences: ${counts.articleReferences} in DB (from ${refFiles.length} ref.ts files x 2 locales)`
  );

  const avgChoicesPerQuestion =
    counts.questions > 0 ? counts.questionChoices / counts.questions : 0;
  log(
    `Choices: ${counts.questionChoices} in DB (~${avgChoicesPerQuestion.toFixed(1)} per question)`
  );
  log(`Content-Author links: ${counts.contentAuthors} in DB`);

  if (answerFiles.length !== questionFiles.length) {
    logError(
      `Answer files (${answerFiles.length}) != Question files (${questionFiles.length})`
    );
    allMatch = false;
  }

  log("\n=== DATA INTEGRITY ===\n");
  const integrityResult = yield* Effect.either(getDataIntegrity(config));
  if (integrityResult._tag === "Left") {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Failed to query database: ${getUnknownMessage(integrityResult.left)}`,
      })
    );
  }

  const integrity = integrityResult.right;

  allMatch =
    !logIntegrityList(
      "questions without choices",
      integrity.questionsWithoutChoices,
      `All ${integrity.totalQuestions} questions have choices`
    ) && allMatch;
  allMatch =
    !logIntegrityList(
      "questions without authors",
      integrity.questionsWithoutAuthors,
      `All ${integrity.totalQuestions} questions have authors`
    ) && allMatch;
  allMatch =
    !logIntegrityList(
      "sections without topics",
      integrity.sectionsWithoutTopics,
      `All ${integrity.totalSections} sections have topics`
    ) && allMatch;
  allMatch =
    !logIntegrityList(
      "active tryouts without published scales",
      integrity.activeTryoutsWithoutScale,
      `All ${counts.tryoutSets} active tryout sets have published scales`
    ) && allMatch;

  const articlesWithRefs =
    integrity.totalArticles - integrity.articlesWithoutReferences.length;
  log(
    `Articles with references: ${articlesWithRefs}/${integrity.totalArticles}`
  );

  log("\n=== GRAPH IDENTITY ===\n");
  const graphIdentityResult = yield* Effect.either(
    getGraphIdentityIntegrity(config)
  );
  if (graphIdentityResult._tag === "Left") {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Failed to verify graph identity: ${getUnknownMessage(graphIdentityResult.left)}`,
      })
    );
  }

  allMatch = logGraphIdentityIntegrity(graphIdentityResult.right) && allMatch;

  log("\n=== QURAN RUNTIME ===\n");
  const quranRuntimeResult = yield* Effect.either(
    verifyQuranRuntime(config, options)
  );
  if (quranRuntimeResult._tag === "Left") {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Failed to verify Quran runtime: ${getUnknownMessage(quranRuntimeResult.left)}`,
      })
    );
  }
  allMatch = quranRuntimeResult.right && allMatch;

  log("\n=== SUMMARY ===\n");
  if (allMatch) {
    logVerifySuccess(counts);
    return;
  }

  logError("Content mismatch detected!");
  if (options.prod) {
    log("\nRun 'pnpm --filter @repo/backend sync:prod' to fix");
  } else {
    log("\nRun 'pnpm --filter @repo/backend sync' to fix");
  }
  return yield* Effect.fail(
    new ScriptFailureError({ message: "Content verification failed." })
  );
});
