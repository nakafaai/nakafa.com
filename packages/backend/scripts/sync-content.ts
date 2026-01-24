#!/usr/bin/env tsx
import { execSync } from "node:child_process";
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
  parseSubjectMaterialFile,
  parseSubjectPath,
  readArticleReferences,
  readExerciseChoices,
  readMdxFile,
} from "./lib/mdxParser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENTS_DIR = path.resolve(__dirname, "../../contents");
const SYNC_STATE_FILE = path.resolve(__dirname, "../.sync-state.json");

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

/**
 * Batch sizes for Convex mutations.
 *
 * Convex limits per mutation (from docs):
 * - Documents written: 16,000
 * - Documents scanned: 32,000
 * - Data written: 16 MiB
 * - Execution time: 1 second (user code only)
 *
 * Write amplification per content type:
 * - Articles: ~65 writes/item (1 article + ~2 authors + ~30 references × 2)
 * - Subject Topics: 1 write/item (no nested writes)
 * - Subject Sections: ~5 writes/item (1 section + ~2 authors × 2)
 * - Exercise Sets: 1 write/item (no nested writes)
 * - Exercise Questions: ~15 writes/item (1 question + ~2 authors × 2 + 5 choices × 2)
 *
 * Current batch sizes balance:
 * - Safety margin: Stay well under 16,000 write limit
 * - Performance: Maximize items per HTTP request
 * - Memory: Avoid OOM from large payloads
 *
 * Max writes per batch (safety check):
 * - Articles: 50 × 65 = 3,250 writes (20% of limit)
 * - Subject Topics: 50 × 1 = 50 writes
 * - Subject Sections: 20 × 5 = 100 writes
 * - Exercise Sets: 50 × 1 = 50 writes
 * - Exercise Questions: 30 × 15 = 450 writes
 */
const BATCH_SIZES = {
  articles: 50,
  subjectTopics: 50,
  subjectSections: 20,
  exerciseSets: 50,
  exerciseQuestions: 30,
} as const;

/** Regex to extract locale from material file paths (e.g., "en-material.ts" -> "en") */
const LOCALE_MATERIAL_FILE_REGEX = /\/([a-z]{2})-material\.ts$/;

interface SyncOptions {
  locale?: Locale;
  force?: boolean;
  authors?: boolean;
  sequential?: boolean;
  incremental?: boolean;
  prod?: boolean;
}

/**
 * Sync state persisted between runs for incremental sync.
 * Tracks the last successful sync timestamp and git commit.
 */
interface SyncState {
  lastSyncTimestamp: number;
  lastSyncCommit: string;
  contentHashes: Record<string, string>;
}

/**
 * Load sync state from disk.
 * Returns null if no previous sync state exists.
 */
function loadSyncState(): SyncState | null {
  try {
    if (!fs.existsSync(SYNC_STATE_FILE)) {
      return null;
    }
    const content = fs.readFileSync(SYNC_STATE_FILE, "utf8");
    return JSON.parse(content) as SyncState;
  } catch {
    return null;
  }
}

/**
 * Save sync state to disk after successful sync.
 */
function saveSyncState(state: SyncState): void {
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Get the current git commit hash.
 */
function getCurrentGitCommit(): string {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: CONTENTS_DIR,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Get files changed since a specific git commit.
 * Returns relative paths from CONTENTS_DIR.
 */
function getChangedFilesSince(commit: string): Set<string> {
  try {
    const output = execSync(`git diff --name-only ${commit} HEAD`, {
      cwd: CONTENTS_DIR,
      encoding: "utf8",
    });
    const changedFiles = new Set<string>();
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) {
        changedFiles.add(path.resolve(CONTENTS_DIR, trimmed));
      }
    }
    return changedFiles;
  } catch {
    return new Set();
  }
}

interface PhaseMetrics {
  phase: string;
  itemCount: number;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  itemsPerSecond?: number;
}

interface SyncMetrics {
  phases: PhaseMetrics[];
  totalStartTime: number;
  totalEndTime?: number;
  totalDurationMs?: number;
  totalItems?: number;
}

function createMetrics(): SyncMetrics {
  return {
    phases: [],
    totalStartTime: performance.now(),
  };
}

function startPhase(metrics: SyncMetrics, phase: string): PhaseMetrics {
  const phaseMetrics: PhaseMetrics = {
    phase,
    itemCount: 0,
    startTime: performance.now(),
  };
  metrics.phases.push(phaseMetrics);
  return phaseMetrics;
}

function endPhase(phase: PhaseMetrics, itemCount: number): void {
  phase.endTime = performance.now();
  phase.itemCount = itemCount;
  phase.durationMs = phase.endTime - phase.startTime;
  phase.itemsPerSecond =
    phase.durationMs > 0 ? (itemCount / phase.durationMs) * 1000 : 0;
}

function addPhaseMetrics(
  metrics: SyncMetrics,
  phaseName: string,
  result: SyncResult
): void {
  const itemCount = result.created + result.updated + result.unchanged;
  metrics.phases.push({
    phase: phaseName,
    startTime: 0,
    itemCount,
    durationMs: result.durationMs,
    itemsPerSecond: result.itemsPerSecond,
  });
}

function finalizeMetrics(metrics: SyncMetrics): void {
  metrics.totalEndTime = performance.now();
  metrics.totalDurationMs = metrics.totalEndTime - metrics.totalStartTime;
  metrics.totalItems = metrics.phases.reduce((sum, p) => sum + p.itemCount, 0);
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function logPhaseMetrics(phase: PhaseMetrics): void {
  const duration = phase.durationMs ? formatDuration(phase.durationMs) : "N/A";
  const rate = phase.itemsPerSecond ? phase.itemsPerSecond.toFixed(1) : "N/A";
  log(
    `  ${phase.phase}: ${phase.itemCount} items in ${duration} (${rate}/sec)`
  );
}

function logSyncMetrics(metrics: SyncMetrics): void {
  log("\n=== PERFORMANCE METRICS ===\n");
  for (const phase of metrics.phases) {
    logPhaseMetrics(phase);
  }
  if (metrics.totalDurationMs && metrics.totalItems !== undefined) {
    log("---");
    log(
      `  Total: ${metrics.totalItems} items in ${formatDuration(metrics.totalDurationMs)}`
    );
    const overallRate =
      metrics.totalDurationMs > 0
        ? ((metrics.totalItems / metrics.totalDurationMs) * 1000).toFixed(1)
        : "N/A";
    log(`  Overall rate: ${overallRate} items/sec`);
  }
}

interface BatchProgress {
  totalItems: number;
  processedItems: number;
  batchSize: number;
  startTime: number;
}

function createBatchProgress(
  totalItems: number,
  batchSize: number
): BatchProgress {
  return {
    totalItems,
    processedItems: 0,
    batchSize,
    startTime: performance.now(),
  };
}

function updateBatchProgress(
  progress: BatchProgress,
  batchItemCount: number
): void {
  progress.processedItems += batchItemCount;
}

function formatBatchProgress(
  progress: BatchProgress,
  batchNum: number,
  totalBatches: number,
  batchItemCount: number
): string {
  const percentage = (
    (progress.processedItems / progress.totalItems) *
    100
  ).toFixed(0);
  const elapsed = performance.now() - progress.startTime;

  let etaStr = "";
  if (
    progress.processedItems > 0 &&
    progress.processedItems < progress.totalItems
  ) {
    const rate = progress.processedItems / elapsed;
    const remaining = progress.totalItems - progress.processedItems;
    const etaMs = remaining / rate;
    etaStr = ` ETA: ${formatDuration(etaMs)}`;
  }

  return `Batch ${batchNum}/${totalBatches} (${batchItemCount} items) [${percentage}%]${etaStr}`;
}

interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  durationMs?: number;
  itemsPerSecond?: number;
}

interface ConvexConfig {
  url: string;
  accessToken: string;
}

interface ContentCounts {
  articles: number;
  subjectTopics: number;
  subjectSections: number;
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
  sectionsWithoutTopics: string[];
  totalQuestions: number;
  totalArticles: number;
  totalSections: number;
}

interface StaleContent {
  staleArticles: Array<{ id: string; slug: string; locale: string }>;
  staleSubjectTopics: Array<{ id: string; slug: string; locale: string }>;
  staleSubjectSections: Array<{ id: string; slug: string; locale: string }>;
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

function logWarning(message: string) {
  console.warn(`WARNING: ${message}`);
}

function logSuccess(message: string) {
  console.log(`OK: ${message}`);
}

interface StaleItem {
  id: string;
  slug: string;
  locale: string;
}

/**
 * Logs a list of stale items with truncation for large lists.
 * Shows up to maxItems entries, with a "... and X more" message for the rest.
 */
function logStaleItems(label: string, items: StaleItem[], maxItems = 10): void {
  if (items.length === 0) {
    return;
  }

  log(`${label} (${items.length}):`);
  for (const item of items.slice(0, maxItems)) {
    log(`  - ${item.slug} (${item.locale})`);
  }
  if (items.length > maxItems) {
    log(`  ... and ${items.length - maxItems} more`);
  }
}

/**
 * Deletes stale content of a specific type by calling the appropriate mutation.
 * Returns whether any content was deleted.
 */
async function deleteStaleItems(
  config: ConvexConfig,
  mutationPath: string,
  paramName: string,
  items: StaleItem[],
  successLabel: string
): Promise<boolean> {
  if (items.length === 0) {
    return false;
  }

  const ids = items.map((item) => item.id);
  const result = await runConvexMutationGeneric<DeleteResult>(
    config,
    mutationPath,
    { [paramName]: ids }
  );
  logSuccess(`Deleted ${result.deleted} ${successLabel}`);
  return true;
}

function getConvexConfig(options: SyncOptions = {}): ConvexConfig {
  const isProd = options.prod;

  // Determine which URL to use
  const url = isProd ? process.env.CONVEX_PROD_URL : process.env.CONVEX_URL;

  if (!url) {
    if (isProd) {
      throw new Error(
        "CONVEX_PROD_URL not set. Add your production Convex URL to .env.local\n" +
          "Find it in Convex Dashboard → Settings → Deployment URL"
      );
    }
    throw new Error("CONVEX_URL not set. Run: npx convex dev");
  }

  // Get access token from ~/.convex/config.json
  const convexConfigPath = path.join(os.homedir(), ".convex", "config.json");
  if (!fs.existsSync(convexConfigPath)) {
    throw new Error("Not authenticated. Run: npx convex dev");
  }

  const convexConfig = JSON.parse(
    fs.readFileSync(convexConfigPath, "utf8")
  ) as { accessToken?: string };

  if (!convexConfig.accessToken) {
    throw new Error("No access token. Run: npx convex dev");
  }

  if (isProd) {
    logWarning(`PRODUCTION MODE: Syncing to ${url}`);
  }

  return { url, accessToken: convexConfig.accessToken };
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
    if (arg === "--sequential") {
      options.sequential = true;
    }
    if (arg === "--incremental") {
      options.incremental = true;
    }
    if (arg === "--prod") {
      options.prod = true;
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
  const startTime = performance.now();
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

  const totalBatches = Math.ceil(articles.length / BATCH_SIZES.articles);
  const progress = createBatchProgress(articles.length, BATCH_SIZES.articles);

  for (let i = 0; i < articles.length; i += BATCH_SIZES.articles) {
    const batch = articles.slice(i, i + BATCH_SIZES.articles);
    const batchNum = Math.floor(i / BATCH_SIZES.articles) + 1;
    log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncArticles",
      { articles: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );
  log(
    `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
  );

  if (processed === articles.length) {
    logSuccess(`${processed}/${files.length} files synced`);
  } else {
    logError(`Mismatch: ${processed} processed vs ${articles.length} parsed`);
  }

  return { ...totals, durationMs, itemsPerSecond };
}

const LOCALE_SUBJECT_MATERIAL_FILE_REGEX = /\/([a-z]{2})-material\.ts$/;

async function syncSubjectTopics(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  const startTime = performance.now();
  log("\n--- SUBJECT TOPICS ---\n");

  const pattern = options.locale
    ? `subject/**/_data/${options.locale}-material.ts`
    : "subject/**/_data/*-material.ts";

  const materialFiles = await globFiles(pattern);
  log(`Material files found: ${materialFiles.length}`);

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const topics: Array<{
    locale: Locale;
    slug: string;
    category: string;
    grade: string;
    material: string;
    topic: string;
    title: string;
    description?: string;
    sectionCount: number;
  }> = [];
  const errors: string[] = [];

  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(
        LOCALE_SUBJECT_MATERIAL_FILE_REGEX
      );
      if (!localeMatch) {
        continue;
      }

      const locale = localeMatch[1] as Locale;
      const parsedTopics = await parseSubjectMaterialFile(materialFile, locale);

      for (const topic of parsedTopics) {
        topics.push({
          locale: topic.locale,
          slug: topic.slug,
          category: topic.category,
          grade: topic.grade,
          material: topic.material,
          topic: topic.topic,
          title: topic.title,
          description: topic.description,
          sectionCount: topic.sectionCount,
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

  log(`Topics parsed: ${topics.length}`);

  const totalBatches = Math.ceil(topics.length / BATCH_SIZES.subjectTopics);
  const progress = createBatchProgress(
    topics.length,
    BATCH_SIZES.subjectTopics
  );

  for (let i = 0; i < topics.length; i += BATCH_SIZES.subjectTopics) {
    const batch = topics.slice(i, i + BATCH_SIZES.subjectTopics);
    const batchNum = Math.floor(i / BATCH_SIZES.subjectTopics) + 1;
    log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncSubjectTopics",
      { topics: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );
  log(
    `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
  );

  if (processed === topics.length) {
    logSuccess(`${processed} subject topics synced`);
  } else {
    logError(`Mismatch: ${processed} processed vs ${topics.length} parsed`);
  }

  return { ...totals, durationMs, itemsPerSecond };
}

async function syncSubjectSections(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  const startTime = performance.now();
  log("\n--- SUBJECT SECTIONS ---\n");

  const pattern = options.locale
    ? `subject/**/${options.locale}.mdx`
    : "subject/**/*.mdx";

  const files = await globFiles(pattern);
  log(`Files found: ${files.length}`);

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const sections: Array<{
    locale: Locale;
    slug: string;
    topicSlug: string;
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

      const topicSlug = `subject/${pathInfo.category}/${pathInfo.grade}/${pathInfo.material}/${pathInfo.topic}`;

      sections.push({
        locale: pathInfo.locale,
        slug: pathInfo.slug,
        topicSlug,
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

  const totalBatches = Math.ceil(sections.length / BATCH_SIZES.subjectSections);
  const progress = createBatchProgress(
    sections.length,
    BATCH_SIZES.subjectSections
  );

  for (let i = 0; i < sections.length; i += BATCH_SIZES.subjectSections) {
    const batch = sections.slice(i, i + BATCH_SIZES.subjectSections);
    const batchNum = Math.floor(i / BATCH_SIZES.subjectSections) + 1;
    log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncSubjectSections",
      { sections: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );
  log(
    `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
  );

  if (processed === sections.length) {
    logSuccess(`${processed}/${files.length} files synced`);
  } else {
    logError(`Mismatch: ${processed} processed vs ${sections.length} parsed`);
  }

  return { ...totals, durationMs, itemsPerSecond };
}

async function syncExerciseSets(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  const startTime = performance.now();
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

  const totalBatches = Math.ceil(sets.length / BATCH_SIZES.exerciseSets);
  const progress = createBatchProgress(sets.length, BATCH_SIZES.exerciseSets);

  for (let i = 0; i < sets.length; i += BATCH_SIZES.exerciseSets) {
    const batch = sets.slice(i, i + BATCH_SIZES.exerciseSets);
    const batchNum = Math.floor(i / BATCH_SIZES.exerciseSets) + 1;
    log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));

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

  return { ...totals, durationMs, itemsPerSecond };
}

async function syncExerciseQuestions(
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> {
  const startTime = performance.now();
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
    questions.length / BATCH_SIZES.exerciseQuestions
  );
  const progress = createBatchProgress(
    questions.length,
    BATCH_SIZES.exerciseQuestions
  );

  for (let i = 0; i < questions.length; i += BATCH_SIZES.exerciseQuestions) {
    const batch = questions.slice(i, i + BATCH_SIZES.exerciseQuestions);
    const batchNum = Math.floor(i / BATCH_SIZES.exerciseQuestions) + 1;
    log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncExerciseQuestions",
      { questions: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );
  log(
    `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
  );

  if (processed === questions.length) {
    logSuccess(
      `${processed}/${questionFiles.length} exercise questions synced`
    );
  } else {
    logError(`Mismatch: ${processed} processed vs ${questions.length} parsed`);
  }

  return { ...totals, durationMs, itemsPerSecond };
}

async function syncAll(
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> {
  const metrics = createMetrics();
  log("=== CONTENT SYNC ===\n");
  if (options.locale) {
    log(`Locale filter: ${options.locale}`);
  }
  if (options.sequential) {
    log("Mode: sequential (for debugging)\n");
  }

  let articleResult: SyncResult;
  let subjectTopicResult: SyncResult;
  let subjectSectionResult: SyncResult;
  let exerciseSetResult: SyncResult;
  let exerciseQuestionResult: SyncResult;

  if (options.sequential) {
    const articlePhase = startPhase(metrics, "Articles");
    articleResult = await syncArticles(config, options);
    endPhase(
      articlePhase,
      articleResult.created + articleResult.updated + articleResult.unchanged
    );

    const topicPhase = startPhase(metrics, "Subject Topics");
    subjectTopicResult = await syncSubjectTopics(config, options);
    endPhase(
      topicPhase,
      subjectTopicResult.created +
        subjectTopicResult.updated +
        subjectTopicResult.unchanged
    );

    const sectionPhase = startPhase(metrics, "Subject Sections");
    subjectSectionResult = await syncSubjectSections(config, options);
    endPhase(
      sectionPhase,
      subjectSectionResult.created +
        subjectSectionResult.updated +
        subjectSectionResult.unchanged
    );

    const setPhase = startPhase(metrics, "Exercise Sets");
    exerciseSetResult = await syncExerciseSets(config, options);
    endPhase(
      setPhase,
      exerciseSetResult.created +
        exerciseSetResult.updated +
        exerciseSetResult.unchanged
    );

    const questionPhase = startPhase(metrics, "Exercise Questions");
    exerciseQuestionResult = await syncExerciseQuestions(config, options);
    endPhase(
      questionPhase,
      exerciseQuestionResult.created +
        exerciseQuestionResult.updated +
        exerciseQuestionResult.unchanged
    );
  } else {
    log("Phase 1: Syncing independent content (articles, topics, sets)...\n");
    const phase1Start = performance.now();

    const [articles, topics, sets] = await Promise.all([
      syncArticles(config, options),
      syncSubjectTopics(config, options),
      syncExerciseSets(config, options),
    ]);

    articleResult = articles;
    subjectTopicResult = topics;
    exerciseSetResult = sets;

    const phase1Duration = performance.now() - phase1Start;
    log(`\nPhase 1 complete in ${formatDuration(phase1Duration)}`);

    log("\nPhase 2: Syncing dependent content (sections, questions)...\n");
    const phase2Start = performance.now();

    const [sections, questions] = await Promise.all([
      syncSubjectSections(config, options),
      syncExerciseQuestions(config, options),
    ]);

    subjectSectionResult = sections;
    exerciseQuestionResult = questions;

    const phase2Duration = performance.now() - phase2Start;
    log(`\nPhase 2 complete in ${formatDuration(phase2Duration)}`);

    addPhaseMetrics(metrics, "Articles", articleResult);
    addPhaseMetrics(metrics, "Subject Topics", subjectTopicResult);
    addPhaseMetrics(metrics, "Subject Sections", subjectSectionResult);
    addPhaseMetrics(metrics, "Exercise Sets", exerciseSetResult);
    addPhaseMetrics(metrics, "Exercise Questions", exerciseQuestionResult);
  }

  finalizeMetrics(metrics);

  log("\n=== SUMMARY ===\n");

  const totalCreated =
    articleResult.created +
    subjectTopicResult.created +
    subjectSectionResult.created +
    exerciseSetResult.created +
    exerciseQuestionResult.created;
  const totalUpdated =
    articleResult.updated +
    subjectTopicResult.updated +
    subjectSectionResult.updated +
    exerciseSetResult.updated +
    exerciseQuestionResult.updated;
  const totalUnchanged =
    articleResult.unchanged +
    subjectTopicResult.unchanged +
    subjectSectionResult.unchanged +
    exerciseSetResult.unchanged +
    exerciseQuestionResult.unchanged;
  const total = totalCreated + totalUpdated + totalUnchanged;

  log(
    `Articles:           ${articleResult.created + articleResult.updated + articleResult.unchanged} (${articleResult.created} new, ${articleResult.updated} updated)`
  );
  log(
    `Subject Topics:     ${subjectTopicResult.created + subjectTopicResult.updated + subjectTopicResult.unchanged} (${subjectTopicResult.created} new, ${subjectTopicResult.updated} updated)`
  );
  log(
    `Subject Sections:   ${subjectSectionResult.created + subjectSectionResult.updated + subjectSectionResult.unchanged} (${subjectSectionResult.created} new, ${subjectSectionResult.updated} updated)`
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

  logSyncMetrics(metrics);
}

interface ValidationError {
  file: string;
  error: string;
}

interface ValidationResult {
  valid: number;
  invalid: number;
  errors: ValidationError[];
}

/**
 * Validate all content files without syncing.
 * Useful for CI/pre-commit hooks to catch errors early.
 *
 * Validates:
 * - MDX metadata (title, authors, date)
 * - Path structure (category, grade, material)
 * - References and choices files
 */
async function validate(): Promise<void> {
  log("=== VALIDATE CONTENT ===\n");
  log("Validating all content files without syncing...\n");

  const startTime = performance.now();

  const articleResult = await validateArticles();
  const subjectResult = await validateSubjects();
  const exerciseResult = await validateExercises();

  const totalValid =
    articleResult.valid + subjectResult.valid + exerciseResult.valid;
  const totalInvalid =
    articleResult.invalid + subjectResult.invalid + exerciseResult.invalid;
  const allErrors = [
    ...articleResult.errors,
    ...subjectResult.errors,
    ...exerciseResult.errors,
  ];

  const duration = performance.now() - startTime;

  log("\n=== VALIDATION SUMMARY ===\n");
  log(
    `Articles:  ${articleResult.valid} valid, ${articleResult.invalid} invalid`
  );
  log(
    `Subjects:  ${subjectResult.valid} valid, ${subjectResult.invalid} invalid`
  );
  log(
    `Exercises: ${exerciseResult.valid} valid, ${exerciseResult.invalid} invalid`
  );
  log("---");
  log(`Total: ${totalValid} valid, ${totalInvalid} invalid`);
  log(`Time: ${formatDuration(duration)}`);

  if (allErrors.length > 0) {
    log("\n=== ERRORS ===\n");
    for (const err of allErrors.slice(0, 20)) {
      logError(`${err.file}`);
      log(`  ${err.error}\n`);
    }
    if (allErrors.length > 20) {
      log(`... and ${allErrors.length - 20} more errors`);
    }
    process.exit(1);
  } else {
    log("\n");
    logSuccess("All content files are valid!");
  }
}

async function validateArticles(): Promise<ValidationResult> {
  const files = await globFiles("articles/**/*.mdx");
  const result: ValidationResult = { valid: 0, invalid: 0, errors: [] };

  log(`Validating ${files.length} article files...`);

  for (const file of files) {
    try {
      parseArticlePath(file);
      await readMdxFile(file);
      const articleDir = getArticleDir(file);
      await readArticleReferences(articleDir);
      result.valid++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file, error: msg });
    }
  }

  return result;
}

async function validateSubjects(): Promise<ValidationResult> {
  const files = await globFiles("subject/**/*.mdx");
  const materialFiles = await globFiles("subject/**/_data/*-material.ts");
  const result: ValidationResult = { valid: 0, invalid: 0, errors: [] };

  log(`Validating ${files.length} subject files...`);

  for (const file of files) {
    try {
      parseSubjectPath(file);
      await readMdxFile(file);
      result.valid++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file, error: msg });
    }
  }

  log(`Validating ${materialFiles.length} material files...`);

  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
      if (localeMatch) {
        const locale = localeMatch[1] as Locale;
        await parseSubjectMaterialFile(materialFile, locale);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file: materialFile, error: msg });
    }
  }

  return result;
}

async function validateExercises(): Promise<ValidationResult> {
  const questionFiles = await globFiles("exercises/**/_question/*.mdx");
  const materialFiles = await globFiles("exercises/**/_data/*-material.ts");
  const result: ValidationResult = { valid: 0, invalid: 0, errors: [] };

  log(`Validating ${questionFiles.length} exercise question files...`);

  for (const file of questionFiles) {
    try {
      parseExercisePath(file);
      await readMdxFile(file);
      const exerciseDir = getExerciseDir(file);
      await readExerciseChoices(exerciseDir);
      result.valid++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file, error: msg });
    }
  }

  log(`Validating ${materialFiles.length} material files...`);

  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
      if (localeMatch) {
        const locale = localeMatch[1] as Locale;
        await parseExerciseMaterialFile(materialFile, locale);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file: materialFile, error: msg });
    }
  }

  return result;
}

async function verify(
  config: ConvexConfig,
  options: SyncOptions = {}
): Promise<void> {
  log("=== VERIFY CONTENT ===\n");

  const articleFiles = await globFiles("articles/**/*.mdx");
  const subjectFiles = await globFiles("subject/**/*.mdx");
  const subjectMaterialFiles = await globFiles(
    "subject/**/_data/*-material.ts"
  );
  const exerciseMaterialFiles = await globFiles(
    "exercises/**/_data/*-material.ts"
  );
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
  log(`  Material files:      ${subjectMaterialFiles.length} (*-material.ts)`);
  log(`  Total MDX files:     ${subjectFiles.length}`);
  log(`    - English (en):    ${subjectFilesEn.length}`);
  log(`    - Indonesian (id): ${subjectFilesId.length}`);

  log("\nExercises:");
  log(`  Material files:      ${exerciseMaterialFiles.length} (*-material.ts)`);
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
    log(`  subjectTopics:       ${counts.subjectTopics}`);
    log(`  subjectSections:     ${counts.subjectSections}`);
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

    if (integrity.sectionsWithoutTopics.length > 0) {
      logError(
        `${integrity.sectionsWithoutTopics.length} sections without topics:`
      );
      for (const slug of integrity.sectionsWithoutTopics.slice(0, 5)) {
        log(`  - ${slug}`);
      }
      if (integrity.sectionsWithoutTopics.length > 5) {
        log(`  ... and ${integrity.sectionsWithoutTopics.length - 5} more`);
      }
      allMatch = false;
    } else {
      logSuccess(`All ${integrity.totalSections} sections have topics`);
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
      log(`  - ${counts.subjectTopics} subject topics`);
      log(`  - ${counts.subjectSections} subject sections`);
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
      if (options.prod) {
        log("\nRun 'pnpm --filter backend sync:prod' to fix");
      } else {
        log("\nRun 'pnpm --filter backend sync:full' to fix");
      }
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
  subjectTopicSlugs: string[];
  subjectSectionSlugs: string[];
  exerciseSetSlugs: string[];
  exerciseQuestionSlugs: string[];
}> {
  const articleFiles = await globFiles("articles/**/*.mdx");
  const subjectFiles = await globFiles("subject/**/*.mdx");
  const subjectMaterialFiles = await globFiles(
    "subject/**/_data/*-material.ts"
  );
  const exerciseMaterialFiles = await globFiles(
    "exercises/**/_data/*-material.ts"
  );
  const questionFiles = await globFiles("exercises/**/_question/*.mdx");

  const articleSlugs = articleFiles.map((file) => {
    const pathInfo = parseArticlePath(file);
    return pathInfo.slug;
  });

  const subjectSectionSlugs = subjectFiles.map((file) => {
    const pathInfo = parseSubjectPath(file);
    return pathInfo.slug;
  });

  const subjectTopicSlugs: string[] = [];
  for (const materialFile of subjectMaterialFiles) {
    const localeMatch = materialFile.match(LOCALE_SUBJECT_MATERIAL_FILE_REGEX);
    if (!localeMatch) {
      continue;
    }

    const locale = localeMatch[1] as Locale;
    try {
      const topics = await parseSubjectMaterialFile(materialFile, locale);
      for (const topic of topics) {
        subjectTopicSlugs.push(topic.slug);
      }
    } catch {
      // ignore parse errors
    }
  }

  const exerciseSetSlugs: string[] = [];
  for (const materialFile of exerciseMaterialFiles) {
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
    subjectTopicSlugs,
    subjectSectionSlugs,
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

/**
 * Finds and optionally deletes authors that have no linked content.
 * Separated from main clean() to reduce cognitive complexity.
 */
async function cleanUnusedAuthors(
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> {
  log("\n--- UNUSED AUTHORS ---\n");
  log("Unused authors = authors with no linked content\n");

  const authorsResult = await runConvexQuery<UnusedAuthors>(
    config,
    "contentSync/queries:findUnusedAuthors"
  );

  if (authorsResult.unusedAuthors.length === 0) {
    logSuccess("No unused authors found!");
    return;
  }

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
    if (options.prod) {
      log("  pnpm --filter backend sync:prod:clean --force --authors");
    } else {
      log("  pnpm --filter backend sync:clean --force --authors");
    }
  }
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
    subjectTopicSlugs,
    subjectSectionSlugs,
    exerciseSetSlugs,
    exerciseQuestionSlugs,
  } = await collectFilesystemSlugs();

  log(`  Articles on disk: ${articleSlugs.length}`);
  log(`  Subject topics on disk: ${subjectTopicSlugs.length}`);
  log(`  Subject sections on disk: ${subjectSectionSlugs.length}`);
  log(`  Exercise sets on disk: ${exerciseSetSlugs.length}`);
  log(`  Exercise questions on disk: ${exerciseQuestionSlugs.length}`);

  log("\nQuerying database for stale content...");
  const stale = await runConvexQueryWithArgs<StaleContent>(
    config,
    "contentSync/queries:findStaleContent",
    {
      articleSlugs,
      subjectTopicSlugs,
      subjectSectionSlugs,
      exerciseSetSlugs,
      exerciseQuestionSlugs,
    }
  );

  const totalStale =
    stale.staleArticles.length +
    stale.staleSubjectTopics.length +
    stale.staleSubjectSections.length +
    stale.staleExerciseSets.length +
    stale.staleExerciseQuestions.length;

  let hasStale = false;
  let deleted = false;

  if (totalStale === 0) {
    logSuccess("No stale content found!");
  } else {
    hasStale = true;
    log(`\nFound ${totalStale} stale items:\n`);

    // Log all stale items by category
    logStaleItems("Stale articles", stale.staleArticles);
    logStaleItems("\nStale subject topics", stale.staleSubjectTopics);
    logStaleItems("\nStale subject sections", stale.staleSubjectSections);
    logStaleItems("\nStale exercise sets", stale.staleExerciseSets);
    logStaleItems("\nStale exercise questions", stale.staleExerciseQuestions);

    if (options.force) {
      log("\nDeleting stale content...");
      deleted = true;

      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleArticles",
        "articleIds",
        stale.staleArticles,
        "stale articles"
      );

      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleSubjectTopics",
        "topicIds",
        stale.staleSubjectTopics,
        "stale subject topics (and their sections)"
      );

      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleSubjectSections",
        "sectionIds",
        stale.staleSubjectSections,
        "stale subject sections"
      );

      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleExerciseSets",
        "setIds",
        stale.staleExerciseSets,
        "stale exercise sets (and their questions)"
      );

      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleExerciseQuestions",
        "questionIds",
        stale.staleExerciseQuestions,
        "stale exercise questions"
      );
    } else {
      log("\nTo delete stale content, run:");
      if (options.prod) {
        log("  pnpm --filter backend sync:prod:clean --force");
      } else {
        log("  pnpm --filter backend sync:clean --force");
      }
    }
  }

  if (options.authors) {
    await cleanUnusedAuthors(config, options);
  }

  log("\n=== CLEAN COMPLETE ===");

  return { hasStale, deleted };
}

/**
 * Incremental sync: only sync files changed since last successful sync.
 * Uses git to detect changed files and skips unchanged content.
 *
 * Benefits:
 * - Much faster for daily syncs (seconds vs minutes)
 * - Reduces load on Convex
 * - Only processes what actually changed
 *
 * Falls back to full sync if:
 * - No previous sync state exists
 * - Git history is unavailable
 * - Last sync commit is not in history
 */
async function syncIncremental(
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> {
  const metrics = createMetrics();
  log("=== INCREMENTAL SYNC ===\n");

  const syncState = loadSyncState();
  const currentCommit = getCurrentGitCommit();

  if (!syncState?.lastSyncCommit) {
    log("No previous sync state found. Running full sync...\n");
    await syncAll(config, options);
    saveSyncState({
      lastSyncTimestamp: Date.now(),
      lastSyncCommit: currentCommit,
      contentHashes: {},
    });
    return;
  }

  if (!currentCommit) {
    log("Git not available. Running full sync...\n");
    await syncAll(config, options);
    return;
  }

  log(`Last sync: ${new Date(syncState.lastSyncTimestamp).toISOString()}`);
  log(`Last commit: ${syncState.lastSyncCommit.slice(0, 8)}`);
  log(`Current commit: ${currentCommit.slice(0, 8)}\n`);

  if (syncState.lastSyncCommit === currentCommit) {
    logSuccess("No changes since last sync. Nothing to do!");
    finalizeMetrics(metrics);
    logSyncMetrics(metrics);
    return;
  }

  const changedFiles = getChangedFilesSince(syncState.lastSyncCommit);

  if (changedFiles.size === 0) {
    logSuccess("No content files changed. Nothing to do!");
    saveSyncState({
      lastSyncTimestamp: Date.now(),
      lastSyncCommit: currentCommit,
      contentHashes: syncState.contentHashes,
    });
    return;
  }

  log(`Changed files: ${changedFiles.size}\n`);

  const hasArticleChanges = [...changedFiles].some((f) =>
    f.includes("/articles/")
  );
  const hasSubjectChanges = [...changedFiles].some((f) =>
    f.includes("/subject/")
  );
  const hasExerciseChanges = [...changedFiles].some((f) =>
    f.includes("/exercises/")
  );

  let articleResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let subjectTopicResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let subjectSectionResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  let exerciseSetResult: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  let exerciseQuestionResult: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };

  if (hasArticleChanges) {
    log("Articles changed - syncing...");
    articleResult = await syncArticles(config, options);
    addPhaseMetrics(metrics, "Articles", articleResult);
  } else {
    log("Articles: no changes");
  }

  if (hasSubjectChanges) {
    log("Subjects changed - syncing...");
    subjectTopicResult = await syncSubjectTopics(config, options);
    subjectSectionResult = await syncSubjectSections(config, options);
    addPhaseMetrics(metrics, "Subject Topics", subjectTopicResult);
    addPhaseMetrics(metrics, "Subject Sections", subjectSectionResult);
  } else {
    log("Subjects: no changes");
  }

  if (hasExerciseChanges) {
    log("Exercises changed - syncing...");
    exerciseSetResult = await syncExerciseSets(config, options);
    exerciseQuestionResult = await syncExerciseQuestions(config, options);
    addPhaseMetrics(metrics, "Exercise Sets", exerciseSetResult);
    addPhaseMetrics(metrics, "Exercise Questions", exerciseQuestionResult);
  } else {
    log("Exercises: no changes");
  }

  finalizeMetrics(metrics);

  log("\n=== SUMMARY ===\n");

  const totalCreated =
    articleResult.created +
    subjectTopicResult.created +
    subjectSectionResult.created +
    exerciseSetResult.created +
    exerciseQuestionResult.created;
  const totalUpdated =
    articleResult.updated +
    subjectTopicResult.updated +
    subjectSectionResult.updated +
    exerciseSetResult.updated +
    exerciseQuestionResult.updated;

  if (totalCreated > 0 || totalUpdated > 0) {
    log(`Changes: ${totalCreated} created, ${totalUpdated} updated`);
  } else {
    log("No changes (all content up to date)");
  }

  logSyncMetrics(metrics);

  saveSyncState({
    lastSyncTimestamp: Date.now(),
    lastSyncCommit: currentCommit,
    contentHashes: syncState.contentHashes,
  });

  log("\n=== INCREMENTAL SYNC COMPLETE ===");
  logSuccess("Sync state saved for next incremental sync");
}

async function syncFull(
  config: ConvexConfig,
  options: SyncOptions = {}
): Promise<void> {
  log("=== FULL SYNC ===\n");
  log(
    "This command will: sync all content, clean stale content, verify data\n"
  );

  const currentCommit = getCurrentGitCommit();

  try {
    await syncAll(config, options);

    log("\n");
    const cleanResult = await clean(config, { force: true, authors: true });

    if (cleanResult.hasStale && cleanResult.deleted) {
      log("\nStale content was found and deleted.");
    }

    log("\n");
    await verify(config, options);

    saveSyncState({
      lastSyncTimestamp: Date.now(),
      lastSyncCommit: currentCommit,
      contentHashes: {},
    });

    log("\n=== FULL SYNC COMPLETE ===");
    logSuccess("All operations completed successfully!");
    logSuccess("Sync state saved for incremental syncs");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError(`Full sync failed: ${msg}`);
    process.exit(1);
  }
}

interface BatchDeleteResult {
  deleted: number;
  hasMore: boolean;
}

/**
 * Delete all items from a table using batched mutations.
 * Keeps calling the mutation until hasMore is false.
 */
async function deleteAllBatched(
  config: ConvexConfig,
  mutationPath: string,
  label: string
): Promise<number> {
  let totalDeleted = 0;
  let batchNum = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await runConvexMutationGeneric<BatchDeleteResult>(
      config,
      mutationPath,
      {}
    );
    totalDeleted += result.deleted;
    hasMore = result.hasMore;

    if (result.deleted > 0) {
      process.stdout.write(
        `\r  Batch ${batchNum}: deleted ${totalDeleted} ${label}...`
      );
      batchNum++;
    }
  }

  if (totalDeleted > 0) {
    process.stdout.write("\n");
  }

  return totalDeleted;
}

/**
 * Reset (delete all) synced content from the database.
 *
 * This is useful for:
 * - Testing the full sync workflow
 * - Starting fresh after major content restructuring
 * - Debugging sync issues
 *
 * Safety features:
 * - Dry run by default (use --force to actually delete)
 * - Extra warning for production database
 * - Proper cascade deletion order
 * - Batched deletes to avoid timeout
 */
async function reset(
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> {
  log("=== RESET CONTENT ===\n");
  log("This will DELETE ALL synced content from the database.\n");

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning("This will permanently delete all content from production.\n");
  }

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  // Get current counts
  log("Current database contents:\n");
  const counts = await runConvexQuery<ContentCounts>(
    config,
    "contentSync/queries:getContentCounts"
  );

  log(`  Content Authors:      ${counts.contentAuthors}`);
  log(`  Article References:   ${counts.articleReferences}`);
  log(`  Exercise Choices:     ${counts.exerciseChoices}`);
  log(`  Exercise Questions:   ${counts.exerciseQuestions}`);
  log(`  Exercise Sets:        ${counts.exerciseSets}`);
  log(`  Subject Sections:     ${counts.subjectSections}`);
  log(`  Subject Topics:       ${counts.subjectTopics}`);
  log(`  Articles:             ${counts.articles}`);
  log(`  Authors:              ${counts.authors}`);

  const totalContent =
    counts.articles +
    counts.subjectTopics +
    counts.subjectSections +
    counts.exerciseSets +
    counts.exerciseQuestions;

  const totalRelated =
    counts.contentAuthors + counts.articleReferences + counts.exerciseChoices;

  log(`\n  Total content items:  ${totalContent}`);
  log(`  Total related items:  ${totalRelated}`);

  if (totalContent === 0 && totalRelated === 0) {
    logSuccess("\nDatabase is already empty. Nothing to delete.");
    return;
  }

  if (!options.force) {
    log("\nTo delete all content, run:");
    if (options.prod) {
      log("  pnpm --filter backend sync:reset --prod --force");
    } else {
      log("  pnpm --filter backend sync:reset --force");
    }
    if (!options.authors) {
      log("\nTo also delete authors, add --authors flag");
    }
    return;
  }

  // Actually delete - order matters for referential integrity
  log("\nDeleting content (in dependency order)...\n");

  const startTime = performance.now();
  let totalDeleted = 0;

  // 1. Delete join tables first
  log("1/9 Deleting content authors...");
  const contentAuthorsDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteContentAuthorsBatch",
    "content authors"
  );
  logSuccess(`  Deleted ${contentAuthorsDeleted} content authors`);
  totalDeleted += contentAuthorsDeleted;

  log("2/9 Deleting article references...");
  const referencesDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteArticleReferencesBatch",
    "article references"
  );
  logSuccess(`  Deleted ${referencesDeleted} article references`);
  totalDeleted += referencesDeleted;

  log("3/9 Deleting exercise choices...");
  const choicesDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteExerciseChoicesBatch",
    "exercise choices"
  );
  logSuccess(`  Deleted ${choicesDeleted} exercise choices`);
  totalDeleted += choicesDeleted;

  // 2. Delete child content
  log("4/9 Deleting exercise questions...");
  const questionsDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteExerciseQuestionsBatch",
    "exercise questions"
  );
  logSuccess(`  Deleted ${questionsDeleted} exercise questions`);
  totalDeleted += questionsDeleted;

  log("5/9 Deleting subject sections...");
  const sectionsDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteSubjectSectionsBatch",
    "subject sections"
  );
  logSuccess(`  Deleted ${sectionsDeleted} subject sections`);
  totalDeleted += sectionsDeleted;

  // 3. Delete parent content
  log("6/9 Deleting exercise sets...");
  const setsDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteExerciseSetsBatch",
    "exercise sets"
  );
  logSuccess(`  Deleted ${setsDeleted} exercise sets`);
  totalDeleted += setsDeleted;

  log("7/9 Deleting subject topics...");
  const topicsDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteSubjectTopicsBatch",
    "subject topics"
  );
  logSuccess(`  Deleted ${topicsDeleted} subject topics`);
  totalDeleted += topicsDeleted;

  log("8/9 Deleting articles...");
  const articlesDeleted = await deleteAllBatched(
    config,
    "contentSync/mutations:deleteArticlesBatch",
    "articles"
  );
  logSuccess(`  Deleted ${articlesDeleted} articles`);
  totalDeleted += articlesDeleted;

  // 4. Optionally delete authors
  if (options.authors) {
    log("9/9 Deleting authors...");
    const authorsDeleted = await deleteAllBatched(
      config,
      "contentSync/mutations:deleteAuthorsBatch",
      "authors"
    );
    logSuccess(`  Deleted ${authorsDeleted} authors`);
    totalDeleted += authorsDeleted;
  } else {
    log("9/9 Skipping authors (use --authors to include)");
  }

  const durationMs = performance.now() - startTime;

  log("\n=== RESET COMPLETE ===\n");
  logSuccess(`Deleted ${totalDeleted} items in ${formatDuration(durationMs)}`);

  // Clear sync state since database is now empty
  if (fs.existsSync(SYNC_STATE_FILE)) {
    fs.unlinkSync(SYNC_STATE_FILE);
    log("Cleared sync state file");
  }

  log("\nTo re-sync content, run:");
  if (options.prod) {
    log("  pnpm --filter backend sync:prod");
  } else {
    log("  pnpm --filter backend sync:full");
  }
}

async function main() {
  const { type, options } = parseArgs();

  // Validate command doesn't need Convex config
  if (type === "validate") {
    await validate();
    return;
  }

  const config = getConvexConfig(options);

  switch (type) {
    case "articles":
      await syncArticles(config, options);
      break;
    case "subjects":
      await syncSubjectTopics(config, options);
      await syncSubjectSections(config, options);
      break;
    case "subject-topics":
      await syncSubjectTopics(config, options);
      break;
    case "subject-sections":
      await syncSubjectSections(config, options);
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
    case "incremental":
      await syncIncremental(config, options);
      break;
    case "verify":
      await verify(config, options);
      break;
    case "clean":
      await clean(config, options);
      break;
    case "full":
      await syncFull(config, options);
      break;
    case "reset":
      await reset(config, options);
      break;
    default:
      logError(`Unknown command: ${type}`);
      log("\nUsage:");
      log("  sync:all              - Sync all content (full scan)");
      log(
        "  sync:incremental      - Sync only changed files since last sync (fast)"
      );
      log(
        "  sync:validate         - Validate content without syncing (for CI)"
      );
      log("  sync:articles         - Sync articles only");
      log("  sync:subjects         - Sync subject topics and sections");
      log("  sync:subject-topics   - Sync subject topics only");
      log("  sync:subject-sections - Sync subject sections only");
      log("  sync:exercises        - Sync exercise sets and questions");
      log("  sync:exercise-sets    - Sync exercise sets only");
      log("  sync:exercise-questions - Sync exercise questions only");
      log("  sync:verify           - Verify DB matches filesystem");
      log("  sync:clean            - Find and remove stale content");
      log(
        "  sync:full             - Full sync: sync, clean, and verify (recommended)"
      );
      log("  sync:reset            - Delete ALL synced content (use --force)");
      log("\nOptions:");
      log("  --locale en|id  - Sync specific locale only");
      log("  --force         - Actually delete content (for clean/reset)");
      log("  --authors       - Also delete authors (for clean/reset)");
      log("  --sequential    - Run sync phases sequentially (for debugging)");
      log("  --prod          - Target production database");
      log("\nEnvironment variables:");
      log("  CONVEX_URL      - Development deployment URL");
      log(
        "  CONVEX_PROD_URL - Production deployment URL (required for --prod)"
      );
      log("\nExamples:");
      log("  pnpm --filter backend sync:full           # Sync to development");
      log("  pnpm --filter backend sync:prod           # Sync to production");
      log("  pnpm --filter backend sync:reset --force  # Delete all content");
      process.exit(1);
  }
}

main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
