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
  dryRun: boolean;
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

function getConvexConfig(): ConvexConfig {
  const url = process.env.CONVEX_URL;

  if (!url) {
    throw new Error(
      "CONVEX_URL environment variable is not set. Run 'npx convex dev' first or set it manually."
    );
  }

  const convexConfigPath = path.join(os.homedir(), ".convex", "config.json");
  if (!fs.existsSync(convexConfigPath)) {
    throw new Error(
      `Convex config not found at ${convexConfigPath}. Run 'npx convex dev' to authenticate.`
    );
  }

  const convexConfig = JSON.parse(
    fs.readFileSync(convexConfigPath, "utf8")
  ) as {
    accessToken?: string;
  };

  if (!convexConfig.accessToken) {
    throw new Error(
      "No access token found in Convex config. Run 'npx convex dev' to authenticate."
    );
  }

  return {
    url,
    accessToken: convexConfig.accessToken,
  };
}

function parseArgs(): { type: string; options: SyncOptions } {
  const args = process.argv.slice(2);
  const type = args[0] || "all";
  const options: SyncOptions = {
    dryRun: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--locale" && args[i + 1]) {
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
    console.error("Convex error logs:", result.logLines?.join("\n"));
    throw new Error(`Convex mutation error: ${result.errorMessage}`);
  }

  return result.value as SyncResult;
}

async function syncArticles(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  console.log("\n📚 Syncing articles...\n");

  const pattern = options.locale
    ? `articles/**/${options.locale}.mdx`
    : "articles/**/*.mdx";

  const files = await globFiles(pattern);
  console.log(`Found ${files.length} article files`);

  if (options.dryRun) {
    console.log("[DRY RUN] Would sync the following articles:");
    for (const file of files) {
      const pathInfo = parseArticlePath(file);
      console.log(`  - ${pathInfo.slug} (${pathInfo.locale})`);
    }
    return { created: 0, updated: 0, unchanged: 0 };
  }

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

  for (const file of files) {
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
  }

  const totalBatches = Math.ceil(articles.length / BATCH_SIZE_ARTICLES);
  for (let i = 0; i < articles.length; i += BATCH_SIZE_ARTICLES) {
    const batch = articles.slice(i, i + BATCH_SIZE_ARTICLES);
    const batchNum = Math.floor(i / BATCH_SIZE_ARTICLES) + 1;
    console.log(
      `Processing batch ${batchNum}/${totalBatches} (${batch.length} articles)`
    );

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncArticles",
      { articles: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  console.log("\n✅ Articles sync complete:");
  console.log(`   Created: ${totals.created}`);
  console.log(`   Updated: ${totals.updated}`);
  console.log(`   Unchanged: ${totals.unchanged}`);
  console.log(
    `   Total processed: ${totals.created + totals.updated + totals.unchanged}`
  );
  console.log(`   Expected: ${files.length}`);

  if (totals.created + totals.updated + totals.unchanged !== files.length) {
    console.error("⚠️  WARNING: Processed count does not match file count!");
  }

  return totals;
}

async function syncSubjects(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  console.log("\n📖 Syncing subjects...\n");

  const pattern = options.locale
    ? `subject/**/${options.locale}.mdx`
    : "subject/**/*.mdx";

  const files = await globFiles(pattern);
  console.log(`Found ${files.length} subject files`);

  if (options.dryRun) {
    console.log("[DRY RUN] Would sync the following subjects:");
    for (const file of files.slice(0, 20)) {
      const pathInfo = parseSubjectPath(file);
      console.log(`  - ${pathInfo.slug} (${pathInfo.locale})`);
    }
    if (files.length > 20) {
      console.log(`  ... and ${files.length - 20} more`);
    }
    return { created: 0, updated: 0, unchanged: 0 };
  }

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
  let parseErrors = 0;

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
      parseErrors++;
      console.error(`Error parsing ${file}:`, error);
    }
  }

  if (parseErrors > 0) {
    console.warn(`⚠️  ${parseErrors} files failed to parse`);
  }

  const totalBatches = Math.ceil(subjects.length / BATCH_SIZE_SUBJECTS);
  for (let i = 0; i < subjects.length; i += BATCH_SIZE_SUBJECTS) {
    const batch = subjects.slice(i, i + BATCH_SIZE_SUBJECTS);
    const batchNum = Math.floor(i / BATCH_SIZE_SUBJECTS) + 1;
    console.log(
      `Processing batch ${batchNum}/${totalBatches} (${batch.length} subjects)`
    );

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncSubjects",
      { subjects: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  console.log("\n✅ Subjects sync complete:");
  console.log(`   Created: ${totals.created}`);
  console.log(`   Updated: ${totals.updated}`);
  console.log(`   Unchanged: ${totals.unchanged}`);
  console.log(
    `   Total processed: ${totals.created + totals.updated + totals.unchanged}`
  );
  console.log(
    `   Expected: ${subjects.length} (${files.length} files, ${parseErrors} parse errors)`
  );

  if (totals.created + totals.updated + totals.unchanged !== subjects.length) {
    console.error("⚠️  WARNING: Processed count does not match parsed count!");
  }

  return totals;
}

async function syncExercises(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  console.log("\n🎯 Syncing exercises...\n");

  const pattern = options.locale
    ? `exercises/**/_question/${options.locale}.mdx`
    : "exercises/**/_question/*.mdx";

  const questionFiles = await globFiles(pattern);
  console.log(`Found ${questionFiles.length} exercise files`);

  if (options.dryRun) {
    console.log("[DRY RUN] Would sync the following exercises:");
    for (const file of questionFiles.slice(0, 20)) {
      const pathInfo = parseExercisePath(file);
      console.log(`  - ${pathInfo.slug} (${pathInfo.locale})`);
    }
    if (questionFiles.length > 20) {
      console.log(`  ... and ${questionFiles.length - 20} more`);
    }
    return { created: 0, updated: 0, unchanged: 0 };
  }

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
  let parseErrors = 0;

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
      parseErrors++;
      console.error(`Error parsing ${questionFile}:`, error);
    }
  }

  if (parseErrors > 0) {
    console.warn(`⚠️  ${parseErrors} files failed to parse`);
  }

  const totalBatches = Math.ceil(exercises.length / BATCH_SIZE_EXERCISES);
  for (let i = 0; i < exercises.length; i += BATCH_SIZE_EXERCISES) {
    const batch = exercises.slice(i, i + BATCH_SIZE_EXERCISES);
    const batchNum = Math.floor(i / BATCH_SIZE_EXERCISES) + 1;
    console.log(
      `Processing batch ${batchNum}/${totalBatches} (${batch.length} exercises)`
    );

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncExercises",
      { exercises: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  console.log("\n✅ Exercises sync complete:");
  console.log(`   Created: ${totals.created}`);
  console.log(`   Updated: ${totals.updated}`);
  console.log(`   Unchanged: ${totals.unchanged}`);
  console.log(
    `   Total processed: ${totals.created + totals.updated + totals.unchanged}`
  );
  console.log(
    `   Expected: ${exercises.length} (${questionFiles.length} files, ${parseErrors} parse errors)`
  );

  if (totals.created + totals.updated + totals.unchanged !== exercises.length) {
    console.error("⚠️  WARNING: Processed count does not match parsed count!");
  }

  return totals;
}

async function syncAll(
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> {
  console.log("🔄 Starting full content sync...\n");
  console.log(`Options: ${JSON.stringify(options)}`);

  const articleResult = await syncArticles(config, options);
  const subjectResult = await syncSubjects(config, options);
  const exerciseResult = await syncExercises(config, options);

  console.log(`\n${"=".repeat(50)}`);
  console.log("FULL SYNC SUMMARY");
  console.log("=".repeat(50));
  console.log("\nArticles:");
  console.log(`  Created: ${articleResult.created}`);
  console.log(`  Updated: ${articleResult.updated}`);
  console.log(`  Unchanged: ${articleResult.unchanged}`);
  console.log("\nSubjects:");
  console.log(`  Created: ${subjectResult.created}`);
  console.log(`  Updated: ${subjectResult.updated}`);
  console.log(`  Unchanged: ${subjectResult.unchanged}`);
  console.log("\nExercises:");
  console.log(`  Created: ${exerciseResult.created}`);
  console.log(`  Updated: ${exerciseResult.updated}`);
  console.log(`  Unchanged: ${exerciseResult.unchanged}`);
  console.log("\nTotals:");
  console.log(
    `  Created: ${articleResult.created + subjectResult.created + exerciseResult.created}`
  );
  console.log(
    `  Updated: ${articleResult.updated + subjectResult.updated + exerciseResult.updated}`
  );
  console.log(
    `  Unchanged: ${articleResult.unchanged + subjectResult.unchanged + exerciseResult.unchanged}`
  );
}

async function main() {
  const { type, options } = parseArgs();

  console.log("🚀 Content Sync CLI");
  console.log(`Type: ${type}`);
  console.log(`Locale: ${options.locale || "all"}`);
  console.log(`Dry Run: ${options.dryRun}`);

  const config = getConvexConfig();
  console.log(`Convex URL: ${config.url}`);
  console.log("Mode: HTTP API (using user token)");

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
    default:
      console.error(
        `Unknown type: ${type}. Use: articles, subjects, exercises, or all`
      );
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
