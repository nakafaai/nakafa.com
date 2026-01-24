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
const BATCH_SIZE_EXERCISES = 30;

interface SyncOptions {
  locale?: Locale;
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
  exercises: number;
  authors: number;
  contentAuthors: number;
  articleReferences: number;
  exerciseChoices: number;
}

interface DataIntegrity {
  exercisesWithoutChoices: string[];
  exercisesWithoutAuthors: string[];
  articlesWithoutReferences: string[];
  totalExercises: number;
  totalArticles: number;
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

async function syncExercises(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  log("\n--- EXERCISES ---\n");

  const pattern = options.locale
    ? `exercises/**/_question/${options.locale}.mdx`
    : "exercises/**/_question/*.mdx";

  const questionFiles = await globFiles(pattern);
  log(`Files found: ${questionFiles.length} (question files only)`);

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const exercises: Array<{
    locale: Locale;
    slug: string;
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

      exercises.push({
        locale: pathInfo.locale,
        slug: pathInfo.slug,
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

  const totalBatches = Math.ceil(exercises.length / BATCH_SIZE_EXERCISES);
  for (let i = 0; i < exercises.length; i += BATCH_SIZE_EXERCISES) {
    const batch = exercises.slice(i, i + BATCH_SIZE_EXERCISES);
    const batchNum = Math.floor(i / BATCH_SIZE_EXERCISES) + 1;
    log(`Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncExercises",
      { exercises: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );

  if (processed === exercises.length) {
    logSuccess(`${processed}/${questionFiles.length} exercises synced`);
  } else {
    logError(`Mismatch: ${processed} processed vs ${exercises.length} parsed`);
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
  const exerciseResult = await syncExercises(config, options);

  log("\n=== SUMMARY ===\n");

  const totalCreated =
    articleResult.created + subjectResult.created + exerciseResult.created;
  const totalUpdated =
    articleResult.updated + subjectResult.updated + exerciseResult.updated;
  const totalUnchanged =
    articleResult.unchanged +
    subjectResult.unchanged +
    exerciseResult.unchanged;
  const total = totalCreated + totalUpdated + totalUnchanged;

  log(
    `Articles:  ${articleResult.created + articleResult.updated + articleResult.unchanged} (${articleResult.created} new, ${articleResult.updated} updated)`
  );
  log(
    `Subjects:  ${subjectResult.created + subjectResult.updated + subjectResult.unchanged} (${subjectResult.created} new, ${subjectResult.updated} updated)`
  );
  log(
    `Exercises: ${exerciseResult.created + exerciseResult.updated + exerciseResult.unchanged} (${exerciseResult.created} new, ${exerciseResult.updated} updated)`
  );
  log("---");
  log(`Total:     ${total} items synced`);

  if (totalCreated > 0 || totalUpdated > 0) {
    log(`\nChanges: ${totalCreated} created, ${totalUpdated} updated`);
  } else {
    log("\nNo changes (all content up to date)");
  }
}

async function verify(config: ConvexConfig): Promise<void> {
  log("=== VERIFY CONTENT ===\n");

  // Count all files on disk
  const articleFiles = await globFiles("articles/**/*.mdx");
  const subjectFiles = await globFiles("subject/**/*.mdx");
  const questionFiles = await globFiles("exercises/**/_question/*.mdx");
  const answerFiles = await globFiles("exercises/**/_answer/*.mdx");
  const choicesFiles = await globFiles("exercises/**/choices.ts");
  const refFiles = await globFiles("articles/**/ref.ts");

  // Count locales
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
  log(`  Question files:      ${questionFiles.length} (_question/*.mdx)`);
  log(`    - English (en):    ${questionFilesEn.length}`);
  log(`    - Indonesian (id): ${questionFilesId.length}`);
  log(`  Answer files:        ${answerFiles.length} (_answer/*.mdx)`);
  log(`  Choices files:       ${choicesFiles.length} (choices.ts)`);
  log(
    `  Unique exercises:    ${choicesFiles.length} (1 choices.ts per exercise)`
  );

  // Get counts from database
  log("\n=== DATABASE ===\n");
  try {
    const counts = await runConvexQuery<ContentCounts>(
      config,
      "contentSync/queries:getContentCounts"
    );

    log("Content tables:");
    log(`  articleContents:     ${counts.articles}`);
    log(`  subjectContents:     ${counts.subjects}`);
    log(`  exerciseContents:    ${counts.exercises}`);

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

    // Articles check
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

    // Subjects check
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

    // Exercises check
    if (counts.exercises === questionFiles.length) {
      logSuccess(
        `Exercises: ${counts.exercises} in DB = ${questionFiles.length} question files`
      );
    } else {
      logError(
        `Exercises: ${counts.exercises} in DB != ${questionFiles.length} question files`
      );
      allMatch = false;
    }

    // References check (each article locale has its own references)
    // 7 ref.ts files × 2 locales = 14 articles with references
    log(
      `\nReferences: ${counts.articleReferences} in DB (from ${refFiles.length} ref.ts files × 2 locales)`
    );

    // Choices check
    // Each exercise (per locale) has choices from choices.ts
    // 460 unique exercises × ~5 choices × 2 locales ≈ 4600
    const avgChoicesPerExercise = counts.exerciseChoices / counts.exercises;
    log(
      `Choices: ${counts.exerciseChoices} in DB (~${avgChoicesPerExercise.toFixed(1)} per exercise)`
    );

    // Content authors check
    log(`Content-Author links: ${counts.contentAuthors} in DB`);

    // Answer files check
    if (answerFiles.length !== questionFiles.length) {
      log(
        `\nWARNING: Answer files (${answerFiles.length}) != Question files (${questionFiles.length})`
      );
      hasWarnings = true;
    }

    // Data integrity check
    log("\n=== DATA INTEGRITY ===\n");
    const integrity = await runConvexQuery<DataIntegrity>(
      config,
      "contentSync/queries:getDataIntegrity"
    );

    if (integrity.exercisesWithoutChoices.length > 0) {
      logError(
        `${integrity.exercisesWithoutChoices.length} exercises without choices:`
      );
      for (const slug of integrity.exercisesWithoutChoices.slice(0, 5)) {
        log(`  - ${slug}`);
      }
      if (integrity.exercisesWithoutChoices.length > 5) {
        log(`  ... and ${integrity.exercisesWithoutChoices.length - 5} more`);
      }
      allMatch = false;
    } else {
      logSuccess(`All ${integrity.totalExercises} exercises have choices`);
    }

    if (integrity.exercisesWithoutAuthors.length > 0) {
      logError(
        `${integrity.exercisesWithoutAuthors.length} exercises without authors:`
      );
      for (const slug of integrity.exercisesWithoutAuthors.slice(0, 5)) {
        log(`  - ${slug}`);
      }
      if (integrity.exercisesWithoutAuthors.length > 5) {
        log(`  ... and ${integrity.exercisesWithoutAuthors.length - 5} more`);
      }
      allMatch = false;
    } else {
      logSuccess(`All ${integrity.totalExercises} exercises have authors`);
    }

    // Note: Not all articles have references, so this is informational only
    const articlesWithRefs =
      integrity.totalArticles - integrity.articlesWithoutReferences.length;
    log(
      `Articles with references: ${articlesWithRefs}/${integrity.totalArticles}`
    );

    // Summary
    log("\n=== SUMMARY ===\n");

    if (allMatch) {
      logSuccess("All primary content synced correctly!");
      log(`  - ${counts.articles} articles`);
      log(`  - ${counts.subjects} subjects`);
      log(`  - ${counts.exercises} exercises`);
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
    case "exercises":
      await syncExercises(config, options);
      break;
    case "all":
      await syncAll(config, options);
      break;
    case "verify":
      await verify(config);
      break;
    default:
      logError(`Unknown command: ${type}`);
      log("\nUsage:");
      log("  sync:all        - Sync all content");
      log("  sync:articles   - Sync articles only");
      log("  sync:subjects   - Sync subjects only");
      log("  sync:exercises  - Sync exercises only");
      log("  sync:verify     - Verify DB matches filesystem");
      log("\nOptions:");
      log("  --locale en|id  - Sync specific locale only");
      process.exit(1);
  }
}

main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
