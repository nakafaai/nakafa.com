#!/usr/bin/env tsx
/**
 * Content Sync CLI Script
 *
 * Syncs MDX content from packages/contents to Convex database.
 *
 * Usage:
 *   pnpm --filter backend sync:articles [--locale en|id] [--dry-run]
 *   pnpm --filter backend sync:subjects [--locale en|id] [--dry-run]
 *   pnpm --filter backend sync:exercises [--locale en|id] [--dry-run]
 *   pnpm --filter backend sync:all [--dry-run]
 *
 * Or directly:
 *   tsx scripts/sync-content.ts articles [--locale en|id] [--dry-run]
 */
import { execSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeHash,
  getExerciseDir,
  type Locale,
  parseArticlePath,
  parseDateToEpoch,
  parseExercisePath,
  parseSubjectPath,
  readExerciseChoices,
  readMdxFile,
} from "./lib/mdxParser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENTS_DIR = path.resolve(__dirname, "../../contents");
const BATCH_SIZE = 20;

interface SyncOptions {
  locale?: Locale;
  dryRun: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
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

function runConvexFunction(
  functionPath: string,
  args: Record<string, unknown>
): SyncResult {
  const argsJson = JSON.stringify(args);
  const cmd = `npx convex run "${functionPath}" '${argsJson}'`;

  try {
    const result = execSync(cmd, {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const parsed = JSON.parse(result.trim()) as SyncResult;
    return parsed;
  } catch (error) {
    const execError = error as { stderr?: string; stdout?: string };
    console.error(`Error running ${functionPath}:`);
    if (execError.stderr) {
      console.error(execError.stderr);
    }
    throw error;
  }
}

async function syncArticles(options: SyncOptions): Promise<SyncResult> {
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
  }> = [];

  for (const file of files) {
    const pathInfo = parseArticlePath(file);
    const { metadata, body, contentHash } = await readMdxFile(file);

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
    });
  }

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)} (${batch.length} articles)`
    );

    const result = runConvexFunction(
      "internal.contentSync.actions:syncArticles",
      {
        articles: batch,
      }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  console.log("\n✅ Articles sync complete:");
  console.log(`   Created: ${totals.created}`);
  console.log(`   Updated: ${totals.updated}`);
  console.log(`   Unchanged: ${totals.unchanged}`);

  return totals;
}

async function syncSubjects(options: SyncOptions): Promise<SyncResult> {
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

  for (const file of files) {
    try {
      const pathInfo = parseSubjectPath(file);
      const { metadata, body, contentHash } = await readMdxFile(file);

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
      console.error(`Error parsing ${file}:`, error);
    }
  }

  for (let i = 0; i < subjects.length; i += BATCH_SIZE) {
    const batch = subjects.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(subjects.length / BATCH_SIZE)} (${batch.length} subjects)`
    );

    const result = runConvexFunction(
      "internal.contentSync.actions:syncSubjects",
      {
        subjects: batch,
      }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  console.log("\n✅ Subjects sync complete:");
  console.log(`   Created: ${totals.created}`);
  console.log(`   Updated: ${totals.updated}`);
  console.log(`   Unchanged: ${totals.unchanged}`);

  return totals;
}

async function syncExercises(options: SyncOptions): Promise<SyncResult> {
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
        console.warn(`No answer file found for ${pathInfo.slug}`);
      }

      const choicesData = await readExerciseChoices(exerciseDir);
      const localeChoices = choicesData?.[pathInfo.locale] || [];
      const choices = localeChoices.map((choice, index) => ({
        optionKey: String.fromCharCode(65 + index),
        label: choice.label,
        isCorrect: choice.value,
        order: index,
      }));

      const combinedHash = computeHash(questionParsed.body + answerBody);

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
      console.error(`Error parsing ${questionFile}:`, error);
    }
  }

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(exercises.length / BATCH_SIZE)} (${batch.length} exercises)`
    );

    const result = runConvexFunction(
      "internal.contentSync.actions:syncExercises",
      {
        exercises: batch,
      }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  console.log("\n✅ Exercises sync complete:");
  console.log(`   Created: ${totals.created}`);
  console.log(`   Updated: ${totals.updated}`);
  console.log(`   Unchanged: ${totals.unchanged}`);

  return totals;
}

async function syncAll(options: SyncOptions): Promise<void> {
  console.log("🔄 Starting full content sync...\n");
  console.log(`Options: ${JSON.stringify(options)}`);

  const articleResult = await syncArticles(options);
  const subjectResult = await syncSubjects(options);
  const exerciseResult = await syncExercises(options);

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

  switch (type) {
    case "articles":
      await syncArticles(options);
      break;
    case "subjects":
      await syncSubjects(options);
      break;
    case "exercises":
      await syncExercises(options);
      break;
    case "all":
      await syncAll(options);
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
