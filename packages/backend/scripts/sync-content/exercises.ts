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
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  BATCH_SIZES,
  ExerciseQuestionSyncResultSchema,
  ExerciseSetSyncResultSchema,
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
  getExerciseSetSearchDescription,
  getExerciseSetSearchText,
  getExerciseSetSearchTitle,
} from "@repo/contents/_lib/exercises/search";
import { getExerciseSetGroupRoute } from "@repo/contents/_types/graph/projection";
import { listExerciseSets } from "@repo/contents/_types/material/registry";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type ExerciseQuestionPayload = FunctionArgs<
  typeof internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions
>["questions"][number];

type ExerciseQuestionChoices = ExerciseQuestionPayload["choices"];

interface ExerciseSearchLabels {
  exerciseTypeTitle: string;
  setTitle: string;
}

/** Syncs exercise set metadata from typed Material sources into Convex. */
export const syncExerciseSets = Effect.fn("sync.exerciseSets")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- EXERCISE SETS ---\n");
  }

  const materialSets = listExerciseSets(options.locale);

  if (!options.quiet) {
    log(`Material sets found: ${materialSets.length}`);
  }

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const searchLabelsBySet = yield* readExerciseSearchLabels(options);
  const questionCountByLocaleSlug = yield* readValidatedExerciseQuestionCounts(
    options,
    searchLabelsBySet
  );
  const sets = yield* Effect.forEach(materialSets, (set) =>
    Effect.gen(function* () {
      const countKey = `${set.locale}:${set.slug}`;
      const questionCount = questionCountByLocaleSlug.get(countKey) || 0;
      const searchSource = {
        locale: set.locale,
        category: set.category,
        type: set.type,
        material: set.material,
        exerciseType: set.exerciseType,
        exerciseTypeTitle: set.exerciseTypeTitle,
        setName: set.setName,
        setTitle: set.title,
        year: set.year,
        questionCount,
        description: set.description,
      };
      const searchTitle = getExerciseSetSearchTitle(searchSource);
      const searchDescription = getExerciseSetSearchDescription(searchSource);
      const searchText = getExerciseSetSearchText(searchSource);
      const groupRoute = yield* readExerciseSetGroupRoute(set.slug);

      return {
        locale: set.locale,
        slug: set.slug,
        category: set.category,
        type: set.type,
        material: set.material,
        exerciseType: set.exerciseType,
        exerciseTypeTitle: set.exerciseTypeTitle,
        setName: set.setName,
        title: set.title,
        description: set.description,
        year: set.year === undefined ? undefined : String(set.year),
        questionCount,
        searchTitle,
        searchDescription,
        searchText,
        groupContentHash: computeHash(
          JSON.stringify({
            description: set.description,
            exerciseType: set.exerciseType,
            exerciseTypeTitle: set.exerciseTypeTitle,
            groupRoute,
            locale: set.locale,
            year: set.year,
          })
        ),
        contentHash: computeHash(
          JSON.stringify({
            description: set.description,
            questionCount,
            searchDescription,
            searchText,
            searchTitle,
            slug: set.slug,
            year: set.year,
          })
        ),
      };
    })
  );

  if (!options.quiet) {
    log(`Sets parsed: ${sets.length}`);
  }

  const totalBatches = Math.ceil(sets.length / BATCH_SIZES.exerciseSets);
  const progress = createBatchProgress(sets.length, BATCH_SIZES.exerciseSets);

  for (let index = 0; index < sets.length; index += BATCH_SIZES.exerciseSets) {
    const batch = sets.slice(index, index + BATCH_SIZES.exerciseSets);
    const batchNum = Math.floor(index / BATCH_SIZES.exerciseSets) + 1;

    if (!options.quiet) {
      log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));
    }

    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: batch },
      ExerciseSetSyncResultSchema
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (!options.quiet) {
    log(
      `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    log(
      `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
    );

    if (processed === sets.length) {
      logSuccess(`${processed} exercise sets synced`);
    } else {
      logError(`Mismatch: ${processed} processed vs ${sets.length} parsed`);
    }
  }

  return { ...totals, durationMs, itemsPerSecond };
});

/** Reads the graph-owned parent group route for one authored exercise set. */
const readExerciseSetGroupRoute = Effect.fn("sync.readExerciseSetGroupRoute")(
  function* (setSlug: string) {
    const groupRoute = getExerciseSetGroupRoute(setSlug);

    if (groupRoute) {
      return groupRoute;
    }

    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Exercise set route cannot be projected into a graph group route: ${setSlug}`,
      })
    );
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
    ? `exercises/**/_question/${options.locale}.mdx`
    : "exercises/**/_question/*.mdx";
}

/** Builds set question counts from question payloads that can actually sync. */
const readValidatedExerciseQuestionCounts = Effect.fn(
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

/** Parses one exercise question file into the Convex sync payload. */
const parseQuestionFile = Effect.fn("sync.parseQuestionFile")(function* (
  questionFile: string,
  searchLabelsBySet: ReadonlyMap<string, ExerciseSearchLabels>
) {
  const pathInfo = yield* parseExercisePath(questionFile);
  const exerciseDir = yield* getExerciseDir(questionFile);
  const answerFile = questionFile.replace("_question", "_answer");
  const questionParsed = yield* readMdxFile(questionFile);

  let answerBody = "";
  const answerResult = yield* Effect.either(readMdxFile(answerFile));

  if (answerResult._tag === "Right") {
    const answerParsed = answerResult.right;
    answerBody = answerParsed.body;
  }

  const choices = yield* readRequiredExerciseChoices(exerciseDir, questionFile);

  const setSlug = buildExerciseSetSlug({
    category: pathInfo.category,
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
    category: pathInfo.category,
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

  return {
    locale: pathInfo.locale,
    slug: pathInfo.slug,
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

const readExerciseSearchLabels = (options: SyncOptions) =>
  Effect.sync(() => {
    const labels = new Map<string, ExerciseSearchLabels>();

    for (const set of listExerciseSets(options.locale)) {
      labels.set(`${set.locale}:${set.slug}`, {
        exerciseTypeTitle: set.exerciseTypeTitle,
        setTitle: set.title,
      });
    }

    return labels;
  });

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

const reportQuestionSyncResults = (
  totals: SyncResult,
  questionFilesLength: number,
  questionsLength: number,
  durationMs: number,
  options: SyncOptions
): void => {
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
      `Missing sets: ${uniqueSets.map((slug) => slug.replace("exercises/", "")).join(", ")}`
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
  } else if (totals.skipped) {
    logError(
      `Processed: ${processed} synced, ${totals.skipped} skipped vs ${questionsLength} parsed`
    );
  } else {
    logError(`Mismatch: ${processed} processed vs ${questionsLength} parsed`);
  }
};

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
