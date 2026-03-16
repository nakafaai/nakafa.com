import {
  buildExerciseSetSlug,
  computeHash,
  getExerciseDir,
  parseDateToEpoch,
  parseExerciseMaterialFile,
  parseExercisePath,
  readExerciseChoices,
  readMdxFile,
} from "../lib/mdxParser";
import { runConvexMutation } from "./convexApi";
import { formatDuration, log, logError, logSuccess } from "./logging";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "./metrics";
import { globFiles } from "./runtime";
import {
  BATCH_SIZES,
  LOCALE_MATERIAL_FILE_REGEX,
  parseLocale,
} from "./schemas";
import type { ConvexConfig, Locale, SyncOptions, SyncResult } from "./types";

interface ExerciseSetPayload {
  category: string;
  description?: string;
  exerciseType: string;
  locale: Locale;
  material: string;
  questionCount: number;
  setName: string;
  slug: string;
  title: string;
  type: string;
}

interface QuestionChoice {
  isCorrect: boolean;
  label: string;
  optionKey: string;
  order: number;
}

interface ExerciseQuestionPayload {
  answerBody: string;
  authors: Array<{ name: string }>;
  category: string;
  choices: QuestionChoice[];
  contentHash: string;
  date: number;
  description?: string;
  exerciseType: string;
  locale: Locale;
  material: string;
  number: number;
  questionBody: string;
  setName: string;
  setSlug: string;
  slug: string;
  title: string;
  type: string;
}

export const syncExerciseSets = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> => {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- EXERCISE SETS ---\n");
  }

  const pattern = options.locale
    ? `exercises/**/_data/${options.locale}-material.ts`
    : "exercises/**/_data/*-material.ts";
  const materialFiles = await globFiles(pattern);

  if (!options.quiet) {
    log(`Material files found: ${materialFiles.length}`);
  }

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const sets: ExerciseSetPayload[] = [];
  const errors: string[] = [];

  const questionFiles = await globFiles("exercises/**/_question/*.mdx");
  const questionCountByLocaleSlug = new Map<string, number>();
  for (const questionFile of questionFiles) {
    try {
      const pathInfo = parseExercisePath(questionFile);
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
    } catch {
      // Ignore question files that cannot be parsed for set counts.
    }
  }

  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
      if (!localeMatch) {
        continue;
      }

      const locale = parseLocale(localeMatch[1], materialFile);
      const parsedSets = await parseExerciseMaterialFile(materialFile, locale);

      for (const set of parsedSets) {
        const countKey = `${set.locale}:${set.slug}`;
        sets.push({
          locale: set.locale,
          slug: set.slug,
          category: set.category,
          type: set.type,
          material: set.material,
          exerciseType: set.exerciseType,
          setName: set.setName,
          title: set.title,
          description: set.description,
          questionCount: questionCountByLocaleSlug.get(countKey) || 0,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${materialFile}: ${message}`);
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

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncExerciseSets",
      { sets: batch }
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
};

const parseQuestionFile = async (
  questionFile: string
): Promise<ExerciseQuestionPayload> => {
  const pathInfo = parseExercisePath(questionFile);
  const exerciseDir = getExerciseDir(questionFile);
  const answerFile = questionFile.replace("_question", "_answer");
  const questionParsed = await readMdxFile(questionFile);

  let answerBody = "";
  try {
    const answerParsed = await readMdxFile(answerFile);
    answerBody = answerParsed.body;
  } catch {
    answerBody = "";
  }

  const choicesData = await readExerciseChoices(exerciseDir);
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
    date: parseDateToEpoch(questionParsed.metadata.date),
    questionBody: questionParsed.body,
    answerBody,
    contentHash: computeHash(
      questionParsed.body +
        answerBody +
        JSON.stringify(choices) +
        JSON.stringify(questionParsed.metadata.authors)
    ),
    authors: questionParsed.metadata.authors,
    choices,
  };
};

const processQuestionBatches = async (
  config: ConvexConfig,
  questions: ExerciseQuestionPayload[],
  options: SyncOptions
): Promise<SyncResult> => {
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
    const batch = questions.slice(index, index + BATCH_SIZES.exerciseQuestions);
    const batchNum = Math.floor(index / BATCH_SIZES.exerciseQuestions) + 1;

    if (!options.quiet) {
      log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));
    }

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncExerciseQuestions",
      { questions: batch }
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
};

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

export const syncExerciseQuestions = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> => {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- EXERCISE QUESTIONS ---\n");
  }

  const pattern = options.locale
    ? `exercises/**/_question/${options.locale}.mdx`
    : "exercises/**/_question/*.mdx";
  const questionFiles = await globFiles(pattern);

  if (!options.quiet) {
    log(`Files found: ${questionFiles.length} (question files only)`);
  }

  const questions: ExerciseQuestionPayload[] = [];
  const errors: string[] = [];

  for (const questionFile of questionFiles) {
    try {
      questions.push(await parseQuestionFile(questionFile));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${questionFile}: ${message}`);
    }
  }

  if (errors.length > 0 && !options.quiet) {
    log(`Parse errors: ${errors.length}`);
    for (const error of errors) {
      logError(error);
    }
  }

  const totals = await processQuestionBatches(config, questions, options);
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
};
