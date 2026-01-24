#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeHash,
  getArticleDir,
  getExerciseDir,
  type Locale,
  parseArticlePath,
  parseDateToEpoch,
  parseExerciseMaterialFile,
  parseExercisePath,
  parseSubjectPath,
  readArticleReferences,
  readExerciseChoices,
  readMdxFile,
} from "./lib/mdxParser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENTS_DIR = path.resolve(__dirname, "../../contents");

function loadEnvFile() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=");
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvFile();

const BATCH_SIZE_ARTICLES = 50;
const BATCH_SIZE_SUBJECTS = 20;
const BATCH_SIZE_EXERCISE_SETS = 50;
const BATCH_SIZE_EXERCISE_QUESTIONS = 30;
const LOCALE_MATERIAL_FILE_REGEX = /\/([a-z]{2})-material\.ts$/;

interface SyncOptions {
  locale?: Locale;
  force?: boolean;
  authors?: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
}

interface ConvexConfig {
  url: string;
  accessToken: string;
}

interface ContentCounts {
  articles: number;
  subjects: number;
  exerciseSets: number;
  exerciseQuestions: number;
  authors: number;
  contentAuthors: number;
  articleReferences: number;
  exerciseChoices: number;
}

interface DataIntegrity {
  questionsWithoutChoices: string[];
  questionsWithoutAuthors: string[];
  articlesWithoutReferences: string[];
  totalQuestions: number;
  totalArticles: number;
}

interface StaleContent {
  staleArticles: Array<{ id: string; slug: string; locale: string }>;
  staleSubjects: Array<{ id: string; slug: string; locale: string }>;
  staleExerciseSets: Array<{ id: string; slug: string; locale: string }>;
  staleExerciseQuestions: Array<{ id: string; slug: string; locale: string }>;
}

interface UnusedAuthors {
  unusedAuthors: Array<{ id: string; name: string; username: string }>;
}

interface DeleteResult {
  deleted: number;
}

function log(message: string) {
  console.log(message);
}

function logError(message: string) {
  console.error(`ERROR: ${message}`);
}

function logSuccess(message: string) {
  console.log(`OK: ${message}`);
}

function getConvexConfig(): ConvexConfig {
  const url = process.env.CONVEX_URL;

  if (!url) {
    throw new Error(
      "CONVEX_URL not set. Add it to packages/backend/.env.local"
    );
  }

  const convexConfigPath = path.join(os.homedir(), ".convex", "config.json");
  if (!fs.existsSync(convexConfigPath)) {
    throw new Error("Not authenticated. Run: npx convex dev");
  }

  const convexConfig = JSON.parse(
    fs.readFileSync(convexConfigPath, "utf8")
  ) as {
    accessToken?: string;
  };

  if (!convexConfig.accessToken) {
    throw new Error("No access token. Run: npx convex dev");
  }

  return {
    url,
    accessToken: convexConfig.accessToken,
  };
}

function parseArgs(): { type: string; options: SyncOptions } {
  const args = process.argv.slice(2);
  const type = args[0] || "all";
  const options: SyncOptions = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--locale" && args[i + 1]) {
      const locale = args[i + 1];
      if (locale === "en" || locale === "id") {
        options.locale = locale;
        i++;
      }
    }
    if (arg === "--force") {
      options.force = true;
    }
    if (arg === "--authors") {
      options.authors = true;
    }
  }

  return { type, options };
}

async function globFiles(pattern: string): Promise<string[]> {
  const { glob } = await import("glob");
  return glob(pattern, { cwd: CONTENTS_DIR, absolute: true });
}

async function runConvexMutation(
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>
): Promise<SyncResult> {
  const response = await fetch(`${config.url}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${config.accessToken}`,
    },
    body: JSON.stringify({
      path: functionPath,
      args,
      format: "json",
    }),
  });

  const result = (await response.json()) as {
    status: string;
    value?: SyncResult;
    errorMessage?: string;
    logLines?: string[];
  };

  if (result.status === "error") {
    throw new Error(result.errorMessage || "Unknown Convex error");
  }

  return result.value as SyncResult;
}

async function runConvexQuery<T>(
  config: ConvexConfig,
  functionPath: string
): Promise<T> {
  const response = await fetch(`${config.url}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${config.accessToken}`,
    },
    body: JSON.stringify({
      path: functionPath,
      args: {},
      format: "json",
    }),
  });

  const result = (await response.json()) as {
    status: string;
    value?: unknown;
    errorMessage?: string;
  };

  if (result.status === "error") {
    throw new Error(result.errorMessage || "Unknown Convex error");
  }

  return result.value as T;
}

async function syncArticles(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  log("\n--- ARTICLES ---\n");

  const pattern = options.locale
    ? `articles/**/${options.locale}.mdx`
    : "articles/**/*.mdx";

  const files = await globFiles(pattern);
  log(`Files found: ${files.length}`);

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const articles: Array<{
    locale: Locale;
    slug: string;
    category: string;
    articleSlug: string;
    title: string;
    description?: string;
    date: number;
    body: string;
    contentHash: string;
    authors: Array<{ name: string }>;
    references: Array<{
      title: string;
      authors: string;
      year: number;
      url?: string;
      citation?: string;
      publication?: string;
      details?: string;
    }>;
  }> = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const pathInfo = parseArticlePath(file);
      const { metadata, body } = await readMdxFile(file);
      const articleDir = getArticleDir(file);
      const references = await readArticleReferences(articleDir);

      const combinedContent =
        body + JSON.stringify(references) + JSON.stringify(metadata.authors);
      const contentHash = computeHash(combinedContent);

      articles.push({
        locale: pathInfo.locale,
        slug: pathInfo.slug,
        category: pathInfo.category,
        articleSlug: pathInfo.articleSlug,
        title: metadata.title,
        description: metadata.description,
        date: parseDateToEpoch(metadata.date),
        body,
        contentHash,
        authors: metadata.authors,
        references,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${file}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    log(`Parse errors: ${errors.length}`);
    for (const err of errors) {
      logError(err);
    }
  }

  const totalBatches = Math.ceil(articles.length / BATCH_SIZE_ARTICLES);
  for (let i = 0; i < articles.length; i += BATCH_SIZE_ARTICLES) {
    const batch = articles.slice(i, i + BATCH_SIZE_ARTICLES);
    const batchNum = Math.floor(i / BATCH_SIZE_ARTICLES) + 1;
    log(`Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncArticles",
      { articles: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );

  if (processed === articles.length) {
    logSuccess(`${processed}/${files.length} files synced`);
  } else {
    logError(`Mismatch: ${processed} processed vs ${articles.length} parsed`);
  }

  return totals;
}

async function syncSubjects(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  log("\n--- SUBJECTS ---\n");

  const pattern = options.locale
    ? `subject/**/${options.locale}.mdx`
    : "subject/**/*.mdx";

  const files = await globFiles(pattern);
  log(`Files found: ${files.length}`);

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const subjects: Array<{
    locale: Locale;
    slug: string;
    category: string;
    grade: string;
    material: string;
    topic: string;
    section: string;
    title: string;
    description?: string;
    date: number;
    subject?: string;
    body: string;
    contentHash: string;
    authors: Array<{ name: string }>;
  }> = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const pathInfo = parseSubjectPath(file);
      const { metadata, body } = await readMdxFile(file);

      const combinedContent = body + JSON.stringify(metadata.authors);
      const contentHash = computeHash(combinedContent);

      subjects.push({
        locale: pathInfo.locale,
        slug: pathInfo.slug,
        category: pathInfo.category,
        grade: pathInfo.grade,
        material: pathInfo.material,
        topic: pathInfo.topic,
        section: pathInfo.section,
        title: metadata.title,
        description: metadata.description,
        date: parseDateToEpoch(metadata.date),
        subject: metadata.subject,
        body,
        contentHash,
        authors: metadata.authors,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${file}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    log(`Parse errors: ${errors.length}`);
    for (const err of errors) {
      logError(err);
    }
  }

  const totalBatches = Math.ceil(subjects.length / BATCH_SIZE_SUBJECTS);
  for (let i = 0; i < subjects.length; i += BATCH_SIZE_SUBJECTS) {
    const batch = subjects.slice(i, i + BATCH_SIZE_SUBJECTS);
    const batchNum = Math.floor(i / BATCH_SIZE_SUBJECTS) + 1;
    log(`Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncSubjects",
      { subjects: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );

  if (processed === subjects.length) {
    logSuccess(`${processed}/${files.length} files synced`);
  } else {
    logError(`Mismatch: ${processed} processed vs ${subjects.length} parsed`);
  }

  return totals;
}

async function syncExerciseSets(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  log("\n--- EXERCISE SETS ---\n");

  const pattern = options.locale
    ? `exercises/**/_data/${options.locale}-material.ts`
    : "exercises/**/_data/*-material.ts";

  const materialFiles = await globFiles(pattern);
  log(`Material files found: ${materialFiles.length}`);

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const sets: Array<{
    locale: Locale;
    slug: string;
    category: string;
    type: string;
    material: string;
    exerciseType: string;
    setName: string;
    title: string;
    description?: string;
    questionCount: number;
  }> = [];
  const errors: string[] = [];

  const questionFiles = await globFiles("exercises/**/_question/*.mdx");
  const questionCountBySetSlug = new Map<string, number>();
  for (const qFile of questionFiles) {
    try {
      const pathInfo = parseExercisePath(qFile);
      const setSlug = `exercises/${pathInfo.category}/${pathInfo.examType}/${pathInfo.material}/${pathInfo.exerciseType}/${pathInfo.setName}`;
      const count = questionCountBySetSlug.get(setSlug) || 0;
      questionCountBySetSlug.set(setSlug, count + 1);
    } catch {
      // ignore parse errors here
    }
  }

  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
      if (!localeMatch) {
        continue;
      }

      const locale = localeMatch[1] as Locale;
      const parsedSets = await parseExerciseMaterialFile(materialFile, locale);

      for (const set of parsedSets) {
        const questionCount = questionCountBySetSlug.get(set.slug) || 0;
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
          questionCount,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${materialFile}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    log(`Parse errors: ${errors.length}`);
    for (const err of errors) {
      logError(err);
    }
  }

  log(`Sets parsed: ${sets.length}`);

  const totalBatches = Math.ceil(sets.length / BATCH_SIZE_EXERCISE_SETS);
  for (let i = 0; i < sets.length; i += BATCH_SIZE_EXERCISE_SETS) {
    const batch = sets.slice(i, i + BATCH_SIZE_EXERCISE_SETS);
    const batchNum = Math.floor(i / BATCH_SIZE_EXERCISE_SETS) + 1;
    log(`Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncExerciseSets",
      { sets: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );

  if (processed === sets.length) {
    logSuccess(`${processed} exercise sets synced`);
  } else {
    logError(`Mismatch: ${processed} processed vs ${sets.length} parsed`);
  }

  return totals;
}

async function syncExerciseQuestions(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  log("\n--- EXERCISE QUESTIONS ---\n");

  const pattern = options.locale
    ? `exercises/**/_question/${options.locale}.mdx`
    : "exercises/**/_question/*.mdx";

  const questionFiles = await globFiles(pattern);
  log(`Files found: ${questionFiles.length} (question files only)`);

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const questions: Array<{
    locale: Locale;
    slug: string;
    setSlug: string;
    category: string;
    type: string;
    material: string;
    exerciseType: string;
    setName: string;
    number: number;
    title: string;
    description?: string;
    date: number;
    questionBody: string;
    answerBody: string;
    contentHash: string;
    authors: Array<{ name: string }>;
    choices: Array<{
      optionKey: string;
      label: string;
      isCorrect: boolean;
      order: number;
    }>;
  }> = [];
  const errors: string[] = [];

  for (const questionFile of questionFiles) {
    try {
      const pathInfo = parseExercisePath(questionFile);
      const exerciseDir = getExerciseDir(questionFile);

      const answerFile = questionFile.replace("_question", "_answer");
      const questionParsed = await readMdxFile(questionFile);

      let answerBody = "";
      try {
        const answerParsed = await readMdxFile(answerFile);
        answerBody = answerParsed.body;
      } catch {
        // Answer file is optional
      }

      const choicesData = await readExerciseChoices(exerciseDir);
      const localeChoices = choicesData?.[pathInfo.locale] || [];
      const choices = localeChoices.map((choice, index) => ({
        optionKey: String.fromCharCode(65 + index),
        label: choice.label,
        isCorrect: choice.value,
        order: index,
      }));

      const combinedContent =
        questionParsed.body +
        answerBody +
        JSON.stringify(choices) +
        JSON.stringify(questionParsed.metadata.authors);
      const combinedHash = computeHash(combinedContent);

      const setSlug = `exercises/${pathInfo.category}/${pathInfo.examType}/${pathInfo.material}/${pathInfo.exerciseType}/${pathInfo.setName}`;

      questions.push({
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
        contentHash: combinedHash,
        authors: questionParsed.metadata.authors,
        choices,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${questionFile}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    log(`Parse errors: ${errors.length}`);
    for (const err of errors) {
      logError(err);
    }
  }

  const totalBatches = Math.ceil(
    questions.length / BATCH_SIZE_EXERCISE_QUESTIONS
  );
  for (let i = 0; i < questions.length; i += BATCH_SIZE_EXERCISE_QUESTIONS) {
    const batch = questions.slice(i, i + BATCH_SIZE_EXERCISE_QUESTIONS);
    const batchNum = Math.floor(i / BATCH_SIZE_EXERCISE_QUESTIONS) + 1;
    log(`Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncExerciseQuestions",
      { questions: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );

  if (processed === questions.length) {
    logSuccess(
      `${processed}/${questionFiles.length} exercise questions synced`
    );
  } else {
    logError(`Mismatch: ${processed} processed vs ${questions.length} parsed`);
  }

  return totals;
}

async function syncAll(
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> {
  log("=== CONTENT SYNC ===\n");
  if (options.locale) {
    log(`Locale filter: ${options.locale}`);
  }

  const articleResult = await syncArticles(config, options);
  const subjectResult = await syncSubjects(config, options);
  const exerciseSetResult = await syncExerciseSets(config, options);
  const exerciseQuestionResult = await syncExerciseQuestions(config, options);

  log("\n=== SUMMARY ===\n");

  const totalCreated =
    articleResult.created +
    subjectResult.created +
    exerciseSetResult.created +
    exerciseQuestionResult.created;
  const totalUpdated =
    articleResult.updated +
    subjectResult.updated +
    exerciseSetResult.updated +
    exerciseQuestionResult.updated;
  const totalUnchanged =
    articleResult.unchanged +
    subjectResult.unchanged +
    exerciseSetResult.unchanged +
    exerciseQuestionResult.unchanged;
  const total = totalCreated + totalUpdated + totalUnchanged;

  log(
    `Articles:           ${articleResult.created + articleResult.updated + articleResult.unchanged} (${articleResult.created} new, ${articleResult.updated} updated)`
  );
  log(
    `Subjects:           ${subjectResult.created + subjectResult.updated + subjectResult.unchanged} (${subjectResult.created} new, ${subjectResult.updated} updated)`
  );
  log(
    `Exercise Sets:      ${exerciseSetResult.created + exerciseSetResult.updated + exerciseSetResult.unchanged} (${exerciseSetResult.created} new, ${exerciseSetResult.updated} updated)`
  );
  log(
    `Exercise Questions: ${exerciseQuestionResult.created + exerciseQuestionResult.updated + exerciseQuestionResult.unchanged} (${exerciseQuestionResult.created} new, ${exerciseQuestionResult.updated} updated)`
  );
  log("---");
  log(`Total:              ${total} items synced`);

  if (totalCreated > 0 || totalUpdated > 0) {
    log(`\nChanges: ${totalCreated} created, ${totalUpdated} updated`);
  } else {
    log("\nNo changes (all content up to date)");
  }
}

async function verify(config: ConvexConfig): Promise<void> {
  log("=== VERIFY CONTENT ===\n");

  const articleFiles = await globFiles("articles/**/*.mdx");
  const subjectFiles = await globFiles("subject/**/*.mdx");
  const materialFiles = await globFiles("exercises/**/_data/*-material.ts");
  const questionFiles = await globFiles("exercises/**/_question/*.mdx");
  const answerFiles = await globFiles("exercises/**/_answer/*.mdx");
  const choicesFiles = await globFiles("exercises/**/choices.ts");
  const refFiles = await globFiles("articles/**/ref.ts");

  const articleFilesEn = articleFiles.filter((f) => f.endsWith("/en.mdx"));
  const articleFilesId = articleFiles.filter((f) => f.endsWith("/id.mdx"));
  const subjectFilesEn = subjectFiles.filter((f) => f.endsWith("/en.mdx"));
  const subjectFilesId = subjectFiles.filter((f) => f.endsWith("/id.mdx"));
  const questionFilesEn = questionFiles.filter((f) => f.endsWith("/en.mdx"));
  const questionFilesId = questionFiles.filter((f) => f.endsWith("/id.mdx"));

  log("=== FILESYSTEM ===\n");

  log("Articles:");
  log(`  Total MDX files:     ${articleFiles.length}`);
  log(`    - English (en):    ${articleFilesEn.length}`);
  log(`    - Indonesian (id): ${articleFilesId.length}`);
  log(`  Reference files:     ${refFiles.length} (ref.ts)`);

  log("\nSubjects:");
  log(`  Total MDX files:     ${subjectFiles.length}`);
  log(`    - English (en):    ${subjectFilesEn.length}`);
  log(`    - Indonesian (id): ${subjectFilesId.length}`);

  log("\nExercises:");
  log(`  Material files:      ${materialFiles.length} (*-material.ts)`);
  log(`  Question files:      ${questionFiles.length} (_question/*.mdx)`);
  log(`    - English (en):    ${questionFilesEn.length}`);
  log(`    - Indonesian (id): ${questionFilesId.length}`);
  log(`  Answer files:        ${answerFiles.length} (_answer/*.mdx)`);
  log(`  Choices files:       ${choicesFiles.length} (choices.ts)`);

  log("\n=== DATABASE ===\n");
  try {
    const counts = await runConvexQuery<ContentCounts>(
      config,
      "contentSync/queries:getContentCounts"
    );

    log("Content tables:");
    log(`  articleContents:     ${counts.articles}`);
    log(`  subjectContents:     ${counts.subjects}`);
    log(`  exerciseSets:        ${counts.exerciseSets}`);
    log(`  exerciseQuestions:   ${counts.exerciseQuestions}`);

    log("\nRelated tables:");
    log(`  authors:             ${counts.authors}`);
    log(
      `  contentAuthors:      ${counts.contentAuthors} (content-author links)`
    );
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

    if (counts.subjects === subjectFiles.length) {
      logSuccess(
        `Subjects: ${counts.subjects} in DB = ${subjectFiles.length} files`
      );
    } else {
      logError(
        `Subjects: ${counts.subjects} in DB != ${subjectFiles.length} files`
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
    const integrity = await runConvexQuery<DataIntegrity>(
      config,
      "contentSync/queries:getDataIntegrity"
    );

    if (integrity.questionsWithoutChoices.length > 0) {
      logError(
        `${integrity.questionsWithoutChoices.length} questions without choices:`
      );
      for (const slug of integrity.questionsWithoutChoices.slice(0, 5)) {
        log(`  - ${slug}`);
      }
      if (integrity.questionsWithoutChoices.length > 5) {
        log(`  ... and ${integrity.questionsWithoutChoices.length - 5} more`);
      }
      allMatch = false;
    } else {
      logSuccess(`All ${integrity.totalQuestions} questions have choices`);
    }

    if (integrity.questionsWithoutAuthors.length > 0) {
      logError(
        `${integrity.questionsWithoutAuthors.length} questions without authors:`
      );
      for (const slug of integrity.questionsWithoutAuthors.slice(0, 5)) {
        log(`  - ${slug}`);
      }
      if (integrity.questionsWithoutAuthors.length > 5) {
        log(`  ... and ${integrity.questionsWithoutAuthors.length - 5} more`);
      }
      allMatch = false;
    } else {
      logSuccess(`All ${integrity.totalQuestions} questions have authors`);
    }

    const articlesWithRefs =
      integrity.totalArticles - integrity.articlesWithoutReferences.length;
    log(
      `Articles with references: ${articlesWithRefs}/${integrity.totalArticles}`
    );

    log("\n=== SUMMARY ===\n");

    if (allMatch) {
      logSuccess("All primary content synced correctly!");
      log(`  - ${counts.articles} articles`);
      log(`  - ${counts.subjects} subjects`);
      log(`  - ${counts.exerciseSets} exercise sets`);
      log(`  - ${counts.exerciseQuestions} exercise questions`);
      log(`  - ${counts.articleReferences} references`);
      log(`  - ${counts.exerciseChoices} choices`);
      log(`  - ${counts.authors} authors`);

      if (hasWarnings) {
        log("\nSome warnings found (see above)");
      }
    } else {
      logError("Content mismatch detected!");
      log("\nRun 'pnpm --filter backend sync:all' to fix");
      process.exit(1);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError(`Failed to query database: ${msg}`);
    process.exit(1);
  }
}

async function collectFilesystemSlugs(): Promise<{
  articleSlugs: string[];
  subjectSlugs: string[];
  exerciseSetSlugs: string[];
  exerciseQuestionSlugs: string[];
}> {
  const articleFiles = await globFiles("articles/**/*.mdx");
  const subjectFiles = await globFiles("subject/**/*.mdx");
  const materialFiles = await globFiles("exercises/**/_data/*-material.ts");
  const questionFiles = await globFiles("exercises/**/_question/*.mdx");

  const articleSlugs = articleFiles.map((file) => {
    const pathInfo = parseArticlePath(file);
    return pathInfo.slug;
  });

  const subjectSlugs = subjectFiles.map((file) => {
    const pathInfo = parseSubjectPath(file);
    return pathInfo.slug;
  });

  const exerciseSetSlugs: string[] = [];
  for (const materialFile of materialFiles) {
    const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
    if (!localeMatch) {
      continue;
    }

    const locale = localeMatch[1] as Locale;
    try {
      const sets = await parseExerciseMaterialFile(materialFile, locale);
      for (const set of sets) {
        exerciseSetSlugs.push(set.slug);
      }
    } catch {
      // ignore parse errors
    }
  }

  const exerciseQuestionSlugs = questionFiles.map((file) => {
    const pathInfo = parseExercisePath(file);
    return pathInfo.slug;
  });

  return {
    articleSlugs,
    subjectSlugs,
    exerciseSetSlugs,
    exerciseQuestionSlugs,
  };
}

async function runConvexQueryWithArgs<T>(
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${config.url}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${config.accessToken}`,
    },
    body: JSON.stringify({
      path: functionPath,
      args,
      format: "json",
    }),
  });

  const result = (await response.json()) as {
    status: string;
    value?: unknown;
    errorMessage?: string;
  };

  if (result.status === "error") {
    throw new Error(result.errorMessage || "Unknown Convex error");
  }

  return result.value as T;
}

async function runConvexMutationGeneric<T>(
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${config.url}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${config.accessToken}`,
    },
    body: JSON.stringify({
      path: functionPath,
      args,
      format: "json",
    }),
  });

  const result = (await response.json()) as {
    status: string;
    value?: unknown;
    errorMessage?: string;
  };

  if (result.status === "error") {
    throw new Error(result.errorMessage || "Unknown Convex error");
  }

  return result.value as T;
}

async function clean(
  config: ConvexConfig,
  options: SyncOptions
): Promise<{ hasStale: boolean; deleted: boolean }> {
  log("=== CLEAN STALE CONTENT ===\n");
  log("Stale content = exists in database but source file was deleted\n");

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  log("Scanning filesystem...");
  const {
    articleSlugs,
    subjectSlugs,
    exerciseSetSlugs,
    exerciseQuestionSlugs,
  } = await collectFilesystemSlugs();

  log(`  Articles on disk: ${articleSlugs.length}`);
  log(`  Subjects on disk: ${subjectSlugs.length}`);
  log(`  Exercise sets on disk: ${exerciseSetSlugs.length}`);
  log(`  Exercise questions on disk: ${exerciseQuestionSlugs.length}`);

  log("\nQuerying database for stale content...");
  const stale = await runConvexQueryWithArgs<StaleContent>(
    config,
    "contentSync/queries:findStaleContent",
    { articleSlugs, subjectSlugs, exerciseSetSlugs, exerciseQuestionSlugs }
  );

  const totalStale =
    stale.staleArticles.length +
    stale.staleSubjects.length +
    stale.staleExerciseSets.length +
    stale.staleExerciseQuestions.length;

  let hasStale = false;
  let deleted = false;

  if (totalStale === 0) {
    logSuccess("No stale content found!");
  } else {
    hasStale = true;
    log(`\nFound ${totalStale} stale items:\n`);

    if (stale.staleArticles.length > 0) {
      log(`Stale articles (${stale.staleArticles.length}):`);
      for (const item of stale.staleArticles.slice(0, 10)) {
        log(`  - ${item.slug} (${item.locale})`);
      }
      if (stale.staleArticles.length > 10) {
        log(`  ... and ${stale.staleArticles.length - 10} more`);
      }
    }

    if (stale.staleSubjects.length > 0) {
      log(`\nStale subjects (${stale.staleSubjects.length}):`);
      for (const item of stale.staleSubjects.slice(0, 10)) {
        log(`  - ${item.slug} (${item.locale})`);
      }
      if (stale.staleSubjects.length > 10) {
        log(`  ... and ${stale.staleSubjects.length - 10} more`);
      }
    }

    if (stale.staleExerciseSets.length > 0) {
      log(`\nStale exercise sets (${stale.staleExerciseSets.length}):`);
      for (const item of stale.staleExerciseSets.slice(0, 10)) {
        log(`  - ${item.slug} (${item.locale})`);
      }
      if (stale.staleExerciseSets.length > 10) {
        log(`  ... and ${stale.staleExerciseSets.length - 10} more`);
      }
    }

    if (stale.staleExerciseQuestions.length > 0) {
      log(
        `\nStale exercise questions (${stale.staleExerciseQuestions.length}):`
      );
      for (const item of stale.staleExerciseQuestions.slice(0, 10)) {
        log(`  - ${item.slug} (${item.locale})`);
      }
      if (stale.staleExerciseQuestions.length > 10) {
        log(`  ... and ${stale.staleExerciseQuestions.length - 10} more`);
      }
    }

    if (options.force) {
      log("\nDeleting stale content...");
      deleted = true;

      if (stale.staleArticles.length > 0) {
        const articleIds = stale.staleArticles.map((a) => a.id);
        const result = await runConvexMutationGeneric<DeleteResult>(
          config,
          "contentSync/mutations:deleteStaleArticles",
          { articleIds }
        );
        logSuccess(`Deleted ${result.deleted} stale articles`);
      }

      if (stale.staleSubjects.length > 0) {
        const subjectIds = stale.staleSubjects.map((s) => s.id);
        const result = await runConvexMutationGeneric<DeleteResult>(
          config,
          "contentSync/mutations:deleteStaleSubjects",
          { subjectIds }
        );
        logSuccess(`Deleted ${result.deleted} stale subjects`);
      }

      if (stale.staleExerciseSets.length > 0) {
        const setIds = stale.staleExerciseSets.map((s) => s.id);
        const result = await runConvexMutationGeneric<DeleteResult>(
          config,
          "contentSync/mutations:deleteStaleExerciseSets",
          { setIds }
        );
        logSuccess(
          `Deleted ${result.deleted} stale exercise sets (and their questions)`
        );
      }

      if (stale.staleExerciseQuestions.length > 0) {
        const questionIds = stale.staleExerciseQuestions.map((q) => q.id);
        const result = await runConvexMutationGeneric<DeleteResult>(
          config,
          "contentSync/mutations:deleteStaleExerciseQuestions",
          { questionIds }
        );
        logSuccess(`Deleted ${result.deleted} stale exercise questions`);
      }
    } else {
      log("\nTo delete stale content, run:");
      log("  pnpm --filter backend sync:clean --force");
    }
  }

  if (options.authors) {
    log("\n--- UNUSED AUTHORS ---\n");
    log("Unused authors = authors with no linked content\n");

    const authorsResult = await runConvexQuery<UnusedAuthors>(
      config,
      "contentSync/queries:findUnusedAuthors"
    );

    if (authorsResult.unusedAuthors.length === 0) {
      logSuccess("No unused authors found!");
    } else {
      log(`Found ${authorsResult.unusedAuthors.length} unused authors:\n`);
      for (const author of authorsResult.unusedAuthors.slice(0, 10)) {
        log(`  - ${author.name} (@${author.username})`);
      }
      if (authorsResult.unusedAuthors.length > 10) {
        log(`  ... and ${authorsResult.unusedAuthors.length - 10} more`);
      }

      if (options.force) {
        const authorIds = authorsResult.unusedAuthors.map((a) => a.id);
        const result = await runConvexMutationGeneric<DeleteResult>(
          config,
          "contentSync/mutations:deleteUnusedAuthors",
          { authorIds }
        );
        logSuccess(`Deleted ${result.deleted} unused authors`);
      } else {
        log("\nTo delete unused authors, run:");
        log("  pnpm --filter backend sync:clean --force --authors");
      }
    }
  }

  log("\n=== CLEAN COMPLETE ===");

  return { hasStale, deleted };
}

async function syncFull(config: ConvexConfig): Promise<void> {
  log("=== FULL SYNC ===\n");
  log(
    "This command will: sync all content, clean stale content, verify data\n"
  );

  try {
    await syncAll(config, {});

    log("\n");
    const cleanResult = await clean(config, { force: true, authors: true });

    if (cleanResult.hasStale && cleanResult.deleted) {
      log("\nStale content was found and deleted.");
    }

    log("\n");
    await verify(config);

    log("\n=== FULL SYNC COMPLETE ===");
    logSuccess("All operations completed successfully!");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError(`Full sync failed: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  const { type, options } = parseArgs();

  const config = getConvexConfig();

  switch (type) {
    case "articles":
      await syncArticles(config, options);
      break;
    case "subjects":
      await syncSubjects(config, options);
      break;
    case "exercise-sets":
      await syncExerciseSets(config, options);
      break;
    case "exercise-questions":
      await syncExerciseQuestions(config, options);
      break;
    case "exercises":
      await syncExerciseSets(config, options);
      await syncExerciseQuestions(config, options);
      break;
    case "all":
      await syncAll(config, options);
      break;
    case "verify":
      await verify(config);
      break;
    case "clean":
      await clean(config, options);
      break;
    case "full":
      await syncFull(config);
      break;
    default:
      logError(`Unknown command: ${type}`);
      log("\nUsage:");
      log("  sync:all              - Sync all content");
      log("  sync:articles         - Sync articles only");
      log("  sync:subjects         - Sync subjects only");
      log("  sync:exercises        - Sync exercise sets and questions");
      log("  sync:exercise-sets    - Sync exercise sets only");
      log("  sync:exercise-questions - Sync exercise questions only");
      log("  sync:verify           - Verify DB matches filesystem");
      log("  sync:clean            - Find and remove stale content");
      log(
        "  sync:full             - Full sync: sync, clean, and verify (recommended)"
      );
      log("\nOptions:");
      log("  --locale en|id  - Sync specific locale only");
      log("  --force         - Actually delete stale content (for clean)");
      log("  --authors       - Also clean unused authors (for clean)");
      process.exit(1);
  }
}

main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
