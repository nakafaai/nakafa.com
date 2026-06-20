import { internal } from "@repo/backend/convex/_generated/api";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import {
  computeHash,
  parseDateToEpoch,
  readExerciseChoices,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  buildExerciseSetSlug,
  getExerciseDir,
  parseExercisePath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import type { ExerciseChoicesByLocale } from "@repo/backend/scripts/lib/mdx-parser/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import {
  type ExerciseQuestionChoices,
  type ExerciseQuestionPayload,
  type ExerciseSearchLabels,
  readExerciseSearchLabels,
  readPracticeCategory,
} from "@repo/backend/scripts/sync-content/exerciseSource";
import {
  formatDuration,
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/metrics";
import { readPublicContentRoute } from "@repo/backend/scripts/sync-content/publicRoutes";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  BATCH_SIZES,
  ExerciseQuestionSyncResultSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import {
  getExerciseSearchDescription,
  getExerciseSearchText,
  getExerciseSearchTitle,
} from "@repo/contents/_lib/assessment/search";
import { Effect } from "effect";

/** Builds set question counts from question payloads that can actually sync. */
export const readValidatedExerciseQuestionCounts = Effect.fn(
  "sync.readValidatedExerciseQuestionCounts"
)(function* (
  options: SyncOptions,
  searchLabelsBySet: ReadonlyMap<string, ExerciseSearchLabels>
) {
  const questionFiles = yield* globFiles(getExerciseQuestionPattern(options));
  const questionCountByLocaleSlug = new Map<string, number>();
  const errors: string[] = [];

  for (const questionFile of questionFiles) {
    const questionResult = yield* Effect.either(
      parseQuestionFile(questionFile, searchLabelsBySet)
    );

    if (questionResult._tag === "Left") {
      const message =
        questionResult.left instanceof Error
          ? questionResult.left.message
          : String(questionResult.left);
      errors.push(`${questionFile}: ${message}`);
      continue;
    }

    const question = questionResult.right;
    const countKey = `${question.locale}:${question.setSlug}`;
    questionCountByLocaleSlug.set(
      countKey,
      (questionCountByLocaleSlug.get(countKey) || 0) + 1
    );
  }

  if (errors.length > 0) {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Cannot sync exercise sets with invalid exercise questions:\n${errors.join("\n")}`,
      })
    );
  }

  return questionCountByLocaleSlug;
});

/** Syncs exercise question and answer MDX files into Convex. */
export const syncExerciseQuestions = Effect.fn("sync.exerciseQuestions")(
  function* (config: ConvexConfig, options: SyncOptions) {
    const startTime = performance.now();
    if (!options.quiet) {
      log("\n--- EXERCISE QUESTIONS ---\n");
    }

    const questionFiles = yield* globFiles(getExerciseQuestionPattern(options));

    if (!options.quiet) {
      log(`Files found: ${questionFiles.length} (question files only)`);
    }

    const questions: ExerciseQuestionPayload[] = [];
    const errors: string[] = [];
    const searchLabelsBySet = yield* readExerciseSearchLabels(options);

    for (const questionFile of questionFiles) {
      const result = yield* Effect.either(
        parseQuestionFile(questionFile, searchLabelsBySet)
      );

      if (result._tag === "Left") {
        const message =
          result.left instanceof Error
            ? result.left.message
            : String(result.left);
        errors.push(`${questionFile}: ${message}`);
      } else {
        questions.push(result.right);
      }
    }

    if (errors.length > 0 && !options.quiet) {
      log(`Parse errors: ${errors.length}`);
      for (const error of errors) {
        logError(error);
      }
    }

    const totals = yield* processQuestionBatches(config, questions, options);
    const durationMs = performance.now() - startTime;
    reportQuestionSyncResults(
      totals,
      questionFiles.length,
      questions.length,
      durationMs,
      options
    );

    const processed = totals.created + totals.updated + totals.unchanged;
    return {
      ...totals,
      durationMs,
      itemsPerSecond: durationMs > 0 ? (processed / durationMs) * 1000 : 0,
    };
  }
);

/** Converts authored choices into the ordered Convex sync payload. */
function buildExerciseChoicePayload(
  choices: ExerciseChoicesByLocale["en"]
): ExerciseQuestionChoices["en"] {
  return choices.map((choice, index) => ({
    optionKey: String.fromCharCode(65 + index),
    label: choice.label,
    isCorrect: choice.value,
    order: index,
  }));
}

/** Requires both choice locales before a question can be synced. */
const readRequiredExerciseChoices = Effect.fn(
  "sync.readRequiredExerciseChoices"
)(function* (exerciseDir: string, questionFile: string) {
  const choicesData = yield* readExerciseChoices(exerciseDir);

  if (
    !choicesData ||
    choicesData.en.length === 0 ||
    choicesData.id.length === 0
  ) {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Missing exercise choices for ${questionFile}. Add non-empty en and id choices.ts arrays before syncing this question.`,
      })
    );
  }

  return {
    en: buildExerciseChoicePayload(choicesData.en),
    id: buildExerciseChoicePayload(choicesData.id),
  };
});

/** Returns the locale-scoped question glob shared by set and question sync. */
function getExerciseQuestionPattern(options: SyncOptions) {
  return options.locale
    ? `material/practice/**/question.${options.locale}.mdx`
    : "material/practice/**/question.*.mdx";
}

/** Parses one exercise question file into the Convex sync payload. */
const parseQuestionFile = Effect.fn("sync.parseQuestionFile")(function* (
  questionFile: string,
  searchLabelsBySet: ReadonlyMap<string, ExerciseSearchLabels>
) {
  const pathInfo = yield* parseExercisePath(questionFile);
  const exerciseDir = yield* getExerciseDir(questionFile);
  const answerFile = questionFile.replace("/question.", "/answer.");
  const questionParsed = yield* readMdxFile(questionFile);

  let answerBody = "";
  const answerResult = yield* Effect.either(readMdxFile(answerFile));

  if (answerResult._tag === "Right") {
    const answerParsed = answerResult.right;
    answerBody = answerParsed.body;
  }

  const choices = yield* readRequiredExerciseChoices(exerciseDir, questionFile);
  const setSlug = buildExerciseSetSlug({
    examType: pathInfo.examType,
    material: pathInfo.material,
    exerciseType: pathInfo.exerciseType,
    setName: pathInfo.setName,
    year: pathInfo.year,
  });
  const searchLabels = searchLabelsBySet.get(`${pathInfo.locale}:${setSlug}`);

  if (!searchLabels) {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Missing exercise search labels for ${pathInfo.locale}:${setSlug}. Add this set to the typed Material source before syncing.`,
      })
    );
  }

  const searchSource = {
    locale: pathInfo.locale,
    category: readPracticeCategory(pathInfo.examType),
    type: pathInfo.examType,
    material: pathInfo.material,
    exerciseType: pathInfo.exerciseType,
    exerciseTypeTitle: searchLabels.exerciseTypeTitle,
    setName: pathInfo.setName,
    setTitle: searchLabels.setTitle,
    year: pathInfo.year,
    number: pathInfo.number,
    title: questionParsed.metadata.title,
    description: questionParsed.metadata.description,
    questionBody: questionParsed.body,
    answerBody,
  };
  const date = yield* parseDateToEpoch(questionParsed.metadata.date);
  const searchDescription = getExerciseSearchDescription(searchSource);
  const searchText = getExerciseSearchText(searchSource);
  const searchTitle = getExerciseSearchTitle(searchSource);
  const publicPath = yield* readPublicContentRoute(
    getExerciseQuestionPublicSourcePath(setSlug, pathInfo.number),
    pathInfo.locale
  ).pipe(Effect.map((route) => route.publicPath));

  return {
    locale: pathInfo.locale,
    slug: pathInfo.slug,
    publicPath,
    setSlug,
    category: pathInfo.category,
    type: pathInfo.examType,
    material: pathInfo.material,
    exerciseType: pathInfo.exerciseType,
    setName: pathInfo.setName,
    number: pathInfo.number,
    title: questionParsed.metadata.title,
    description: questionParsed.metadata.description,
    date,
    questionBody: questionParsed.body,
    answerBody,
    searchDescription,
    searchText,
    searchTitle,
    contentHash: computeHash(
      JSON.stringify({
        answerBody,
        authors: questionParsed.metadata.authors,
        category: pathInfo.category,
        choices,
        date,
        description: questionParsed.metadata.description,
        exerciseType: pathInfo.exerciseType,
        locale: pathInfo.locale,
        material: pathInfo.material,
        number: pathInfo.number,
        publicPath,
        questionBody: questionParsed.body,
        searchDescription,
        searchText,
        searchTitle,
        setName: pathInfo.setName,
        setSlug,
        slug: pathInfo.slug,
        title: questionParsed.metadata.title,
        type: pathInfo.examType,
      })
    ),
    authors: questionParsed.metadata.authors,
    choices,
  };
});

/** Builds the authored source-folder question path stored for public route projection. */
function getExerciseQuestionPublicSourcePath(
  setSlug: string,
  questionNumber: number
) {
  return `${setSlug}/question-${questionNumber}`;
}

/** Sends exercise question batches to Convex and aggregates sync counts. */
const processQuestionBatches = Effect.fn("sync.processQuestionBatches")(
  function* (
    config: ConvexConfig,
    questions: ExerciseQuestionPayload[],
    options: SyncOptions
  ) {
    const totals: SyncResult = {
      created: 0,
      updated: 0,
      unchanged: 0,
      choicesCreated: 0,
      authorLinksCreated: 0,
      skipped: 0,
      skippedSetSlugs: [],
    };

    const totalBatches = Math.ceil(
      questions.length / BATCH_SIZES.exerciseQuestions
    );
    const progress = createBatchProgress(
      questions.length,
      BATCH_SIZES.exerciseQuestions
    );

    for (
      let index = 0;
      index < questions.length;
      index += BATCH_SIZES.exerciseQuestions
    ) {
      const batch = questions.slice(
        index,
        index + BATCH_SIZES.exerciseQuestions
      );
      const batchNum = Math.floor(index / BATCH_SIZES.exerciseQuestions) + 1;

      if (!options.quiet) {
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions,
        { questions: batch },
        ExerciseQuestionSyncResultSchema
      );

      totals.created += result.created;
      totals.updated += result.updated;
      totals.unchanged += result.unchanged;
      totals.choicesCreated =
        (totals.choicesCreated || 0) + (result.choicesCreated || 0);
      totals.authorLinksCreated =
        (totals.authorLinksCreated || 0) + (result.authorLinksCreated || 0);
      totals.skipped = (totals.skipped || 0) + (result.skipped || 0);
      if (result.skippedSetSlugs && result.skippedSetSlugs.length > 0) {
        totals.skippedSetSlugs = [
          ...(totals.skippedSetSlugs || []),
          ...result.skippedSetSlugs,
        ];
      }
      updateBatchProgress(progress, batch.length);
    }

    return totals;
  }
);

/**
 * Reports question sync totals after all batches are persisted.
 *
 * Missing set rows stay visible as sync errors because question attempts must
 * resolve through the canonical source set identity before they are usable.
 */
function reportQuestionSyncResults(
  totals: SyncResult,
  questionFilesLength: number,
  questionsLength: number,
  durationMs: number,
  options: SyncOptions
) {
  const processed = totals.created + totals.updated + totals.unchanged;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (options.quiet) {
    return;
  }

  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );

  if (totals.skipped && totals.skipped > 0) {
    logError(`${totals.skipped} questions SKIPPED (missing exercise sets)`);
    const uniqueSets = [...new Set(totals.skippedSetSlugs || [])];
    logError(
      `Missing sets: ${uniqueSets.map((slug) => slug.replace("material/practice/", "")).join(", ")}`
    );
    logError("Add these sets to the typed Material source before syncing.");
  }

  if (totals.choicesCreated || totals.authorLinksCreated) {
    log(
      `Related: ${totals.choicesCreated || 0} choices, ${totals.authorLinksCreated || 0} author links`
    );
  }

  log(
    `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
  );

  const totalProcessed = processed + (totals.skipped || 0);
  if (totalProcessed === questionsLength && !totals.skipped) {
    logSuccess(`${processed}/${questionFilesLength} exercise questions synced`);
    return;
  }

  if (totals.skipped) {
    logError(
      `Processed: ${processed} synced, ${totals.skipped} skipped vs ${questionsLength} parsed`
    );
    return;
  }

  logError(`Mismatch: ${processed} processed vs ${questionsLength} parsed`);
}
