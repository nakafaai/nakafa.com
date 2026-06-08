import type { internal } from "@repo/backend/convex/_generated/api";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import {
  computeHash,
  parseDateToEpoch,
  readExerciseChoices,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import { parseExerciseMaterialFile } from "@repo/backend/scripts/lib/mdx-parser/materials";
import {
  buildExerciseSetSlug,
  getExerciseDir,
  parseExercisePath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
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
  LOCALE_MATERIAL_FILE_REGEX,
  parseLocale,
  SyncResultSchema,
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
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type ExerciseSetPayload = FunctionArgs<
  typeof internal.contentSync.mutations.exercises.bulkSyncExerciseSets
>["sets"][number];

type ExerciseQuestionPayload = FunctionArgs<
  typeof internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions
>["questions"][number];

interface ExerciseSearchLabels {
  exerciseTypeTitle: string;
  setTitle: string;
}

/** Syncs exercise set metadata from material files into Convex. */
export const syncExerciseSets = Effect.fn("sync.exerciseSets")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- EXERCISE SETS ---\n");
  }

  const pattern = options.locale
    ? `exercises/**/_data/${options.locale}-material.ts`
    : "exercises/**/_data/*-material.ts";
  const materialFiles = yield* globFiles(pattern);

  if (!options.quiet) {
    log(`Material files found: ${materialFiles.length}`);
  }

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const sets: ExerciseSetPayload[] = [];
  const errors: string[] = [];

  const questionFiles = yield* globFiles("exercises/**/_question/*.mdx");
  const questionCountByLocaleSlug = new Map<string, number>();
  for (const questionFile of questionFiles) {
    const pathResult = yield* Effect.either(parseExercisePath(questionFile));

    if (pathResult._tag === "Left") {
      continue;
    }

    const pathInfo = pathResult.right;
    const setSlug = buildExerciseSetSlug({
      category: pathInfo.category,
      examType: pathInfo.examType,
      material: pathInfo.material,
      exerciseType: pathInfo.exerciseType,
      setName: pathInfo.setName,
      year: pathInfo.year,
    });
    const countKey = `${pathInfo.locale}:${setSlug}`;
    questionCountByLocaleSlug.set(
      countKey,
      (questionCountByLocaleSlug.get(countKey) || 0) + 1
    );
  }

  for (const materialFile of materialFiles) {
    const result = yield* Effect.either(
      Effect.gen(function* () {
        const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
        if (!localeMatch) {
          return [];
        }

        const locale = yield* parseLocale(localeMatch[1], materialFile);
        const parsedSets = yield* parseExerciseMaterialFile(
          materialFile,
          locale
        );

        return parsedSets.map((set) => {
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
          const searchDescription =
            getExerciseSetSearchDescription(searchSource);
          const searchText = getExerciseSetSearchText(searchSource);

          return {
            locale: set.locale,
            slug: set.slug,
            category: set.category,
            type: set.type,
            material: set.material,
            exerciseType: set.exerciseType,
            setName: set.setName,
            title: set.title,
            description: set.description,
            year: set.year === undefined ? undefined : String(set.year),
            questionCount,
            searchTitle,
            searchDescription,
            searchText,
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
        });
      })
    );

    if (result._tag === "Left") {
      const message =
        result.left instanceof Error
          ? result.left.message
          : String(result.left);
      errors.push(`${materialFile}: ${message}`);
    } else {
      sets.push(...result.right);
    }
  }

  if (errors.length > 0 && !options.quiet) {
    log(`Parse errors: ${errors.length}`);
    for (const error of errors) {
      logError(error);
    }
  }

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

    const result = yield* callConvex(
      config,
      "mutation",
      "contentSync/mutations/exercises:bulkSyncExerciseSets",
      { sets: batch },
      SyncResultSchema
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

  const choicesData = yield* readExerciseChoices(exerciseDir);
  const localeChoices = choicesData?.[pathInfo.locale] || [];
  const choices = localeChoices.map((choice, index) => ({
    optionKey: String.fromCharCode(65 + index),
    label: choice.label,
    isCorrect: choice.value,
    order: index,
  }));

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
        message: `Missing exercise search labels for ${pathInfo.locale}:${setSlug}. Add this set to the matching _data material file.`,
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

const readExerciseSearchLabels = Effect.fn("sync.readExerciseSearchLabels")(
  function* (options: SyncOptions) {
    const pattern = options.locale
      ? `exercises/**/_data/${options.locale}-material.ts`
      : "exercises/**/_data/*-material.ts";
    const materialFiles = yield* globFiles(pattern);
    const labels = new Map<string, ExerciseSearchLabels>();

    for (const materialFile of materialFiles) {
      const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);

      if (!localeMatch) {
        continue;
      }

      const locale = yield* parseLocale(localeMatch[1], materialFile);
      const sets = yield* parseExerciseMaterialFile(materialFile, locale);

      for (const set of sets) {
        labels.set(`${set.locale}:${set.slug}`, {
          exerciseTypeTitle: set.exerciseTypeTitle,
          setTitle: set.title,
        });
      }
    }

    return labels;
  }
);

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

      const result = yield* callConvex(
        config,
        "mutation",
        "contentSync/mutations/exercises:bulkSyncExerciseQuestions",
        { questions: batch },
        SyncResultSchema
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
    logError("Add these sets to your material files in _data/*-material.ts");
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

    const pattern = options.locale
      ? `exercises/**/_question/${options.locale}.mdx`
      : "exercises/**/_question/*.mdx";
    const questionFiles = yield* globFiles(pattern);

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
