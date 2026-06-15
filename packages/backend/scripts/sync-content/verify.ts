import { api } from "@repo/backend/convex/_generated/api";
import {
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import {
  getDataIntegrity,
  getGraphIdentityIntegrity,
} from "@repo/backend/scripts/sync-content/inspection";
import {
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  ContentSearchResultSchema,
  QuranReferenceSchema,
  QuranSurahPageSchema,
  RuntimeContentRouteSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import { getAllSurah } from "@repo/contents/_lib/quran";
import {
  listExercisePlans,
  listSubjectPlans,
} from "@repo/contents/_types/plan/registry";
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

/** Verifies representative Quran routes, runtime reads, and search rows. */
function verifyQuranRuntime(config: ConvexConfig, options: SyncOptions) {
  return Effect.gen(function* () {
    const activeLocales = options.locale ? [options.locale] : locales;

    for (const locale of activeLocales) {
      const route = yield* callConvexQuery(
        config,
        api.contents.queries.runtime.getContentRoute,
        { locale, route: "quran/1" },
        RuntimeContentRouteSchema
      );

      if (!route) {
        logError(`Quran route missing for ${locale}/quran/1`);
        return false;
      }

      logSuccess(`Quran route available for ${locale}/quran/1`);

      const reference = yield* callConvexQuery(
        config,
        api.contents.queries.runtime.getQuranReference,
        {
          fromVerse: 1,
          includeTafsir: true,
          locale,
          surah: 1,
        },
        QuranReferenceSchema
      );

      if (reference?.verses.length !== 1) {
        logError(`Quran reference missing for ${locale} surah 1 verse 1`);
        return false;
      }

      logSuccess(`Quran reference available for ${locale} surah 1 verse 1`);

      const search = yield* callConvexQuery(
        config,
        api.contents.queries.search.search,
        {
          limit: 1,
          locale,
          offset: 0,
          queries: [],
          section: "quran",
        },
        ContentSearchResultSchema
      );

      if (search.items.length === 0) {
        logError(`Quran search row missing for ${locale}`);
        return false;
      }

      logSuccess(`Quran search row available for ${locale}`);
    }

    const surahPage = yield* callConvexQuery(
      config,
      api.contents.queries.runtime.getQuranSurahPage,
      { surah: 1 },
      QuranSurahPageSchema
    );

    if (surahPage?.surahData.verses.length !== 7) {
      logError("Quran surah runtime page missing for surah 1");
      return false;
    }

    logSuccess("Quran surah runtime page available for surah 1");
    return true;
  });
}

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
    subjectFiles,
    questionFiles,
    answerFiles,
    choicesFiles,
    refFiles,
  ] = yield* Effect.all([
    globFiles("articles/**/*.mdx"),
    globFiles("subject/**/*.mdx"),
    globFiles("exercises/**/_question/*.mdx"),
    globFiles("exercises/**/_answer/*.mdx"),
    globFiles("exercises/**/choices.ts"),
    globFiles("articles/**/ref.ts"),
  ]);

  const articleFilesEn = articleFiles.filter((file) =>
    file.endsWith("/en.mdx")
  );
  const articleFilesId = articleFiles.filter((file) =>
    file.endsWith("/id.mdx")
  );
  const subjectFilesEn = subjectFiles.filter((file) =>
    file.endsWith("/en.mdx")
  );
  const subjectFilesId = subjectFiles.filter((file) =>
    file.endsWith("/id.mdx")
  );
  const questionFilesEn = questionFiles.filter((file) =>
    file.endsWith("/en.mdx")
  );
  const questionFilesId = questionFiles.filter((file) =>
    file.endsWith("/id.mdx")
  );
  const subjectPlanCount = listSubjectPlans().length;
  const exercisePlanCount = listExercisePlans().length;

  log("=== FILESYSTEM ===\n");
  log("Articles:");
  log(`  Total MDX files:     ${articleFiles.length}`);
  log(`    - English (en):    ${articleFilesEn.length}`);
  log(`    - Indonesian (id): ${articleFilesId.length}`);
  log(`  Reference files:     ${refFiles.length} (ref.ts)`);

  log("\nSubjects:");
  log(`  Plan sources:        ${subjectPlanCount}`);
  log(`  Total MDX files:     ${subjectFiles.length}`);
  log(`    - English (en):    ${subjectFilesEn.length}`);
  log(`    - Indonesian (id): ${subjectFilesId.length}`);

  log("\nExercises:");
  log(`  Plan sources:        ${exercisePlanCount}`);
  log(`  Question files:      ${questionFiles.length} (_question/*.mdx)`);
  log(`    - English (en):    ${questionFilesEn.length}`);
  log(`    - Indonesian (id): ${questionFilesId.length}`);
  log(`  Answer files:        ${answerFiles.length} (_answer/*.mdx)`);
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
  log(`  subjectTopics:       ${counts.subjectTopics}`);
  log(`  subjectSections:     ${counts.subjectSections}`);
  log(`  exerciseSets:        ${counts.exerciseSets}`);
  log(`  exerciseQuestions:   ${counts.exerciseQuestions}`);
  log(`  contentSearch:       ${counts.contentSearch}`);
  log(`  contentRoutes:       ${counts.contentRoutes}`);
  log(`  learningPrograms:    ${counts.learningPrograms}`);
  log(`  learningProgramSrcs: ${counts.learningProgramSources}`);
  log(`  programOutlines:     ${counts.learningProgramOutlineNodes}`);
  log(`  programOutcomes:     ${counts.learningProgramOutcomes}`);
  log(`  outcomeConcepts:     ${counts.learningProgramOutcomeConcepts}`);
  log(`  learningProgramCov:  ${counts.learningProgramCoverage}`);
  log(`  quranSurahs:         ${counts.quranSurahs}`);
  log(`  quranVerses:         ${counts.quranVerses}`);
  log(`  tryouts:             ${counts.tryouts}`);

  log("\nRelated tables:");
  log(`  authors:             ${counts.authors}`);
  log(`  contentAuthors:      ${counts.contentAuthors} (content-author links)`);
  log(`  articleReferences:   ${counts.articleReferences}`);
  log(`  exerciseChoices:     ${counts.exerciseChoices}`);

  log("\n=== VERIFICATION ===\n");

  let allMatch = true;
  let hasWarnings = false;

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

  if (counts.subjectSections === subjectFiles.length) {
    logSuccess(
      `Subject Sections: ${counts.subjectSections} in DB = ${subjectFiles.length} files`
    );
  } else {
    logError(
      `Subject Sections: ${counts.subjectSections} in DB != ${subjectFiles.length} files`
    );
    allMatch = false;
  }

  if (counts.exerciseQuestions === questionFiles.length) {
    logSuccess(
      `Questions: ${counts.exerciseQuestions} in DB = ${questionFiles.length} question files`
    );
  } else {
    logError(
      `Questions: ${counts.exerciseQuestions} in DB != ${questionFiles.length} question files`
    );
    allMatch = false;
  }

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
    counts.exerciseQuestions > 0
      ? counts.exerciseChoices / counts.exerciseQuestions
      : 0;
  log(
    `Choices: ${counts.exerciseChoices} in DB (~${avgChoicesPerQuestion.toFixed(1)} per question)`
  );
  log(`Content-Author links: ${counts.contentAuthors} in DB`);

  if (answerFiles.length !== questionFiles.length) {
    log(
      `\nWARNING: Answer files (${answerFiles.length}) != Question files (${questionFiles.length})`
    );
    hasWarnings = true;
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
      `All ${counts.tryouts} active tryouts have published scales`
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
    logSuccess("All primary content synced correctly!");
    log(`  - ${counts.articles} articles`);
    log(`  - ${counts.subjectTopics} subject topics`);
    log(`  - ${counts.subjectSections} subject sections`);
    log(`  - ${counts.exerciseSets} exercise sets`);
    log(`  - ${counts.exerciseQuestions} exercise questions`);
    log(`  - ${counts.contentSearch} content search rows`);
    log(`  - ${counts.contentRoutes} content route rows`);
    log(`  - ${counts.quranSurahs} Quran surahs`);
    log(`  - ${counts.quranVerses} Quran verses`);
    log(`  - ${counts.tryouts} tryouts`);
    log(`  - ${counts.articleReferences} references`);
    log(`  - ${counts.exerciseChoices} choices`);
    log(`  - ${counts.authors} authors`);

    if (hasWarnings) {
      log("\nSome warnings found (see above)");
    }
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
