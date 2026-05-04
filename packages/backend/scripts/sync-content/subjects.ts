import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import {
  computeHash,
  parseDateToEpoch,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import { parseSubjectMaterialFile } from "@repo/backend/scripts/lib/mdx-parser/materials";
import { parseSubjectPath } from "@repo/backend/scripts/lib/mdx-parser/paths";
import { runConvexMutation } from "@repo/backend/scripts/sync-content/convexApi";
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
  LOCALE_SUBJECT_MATERIAL_FILE_REGEX,
  parseLocale,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";

interface SubjectTopicPayload {
  category: string;
  description?: string;
  grade: string;
  locale: Locale;
  material: string;
  sectionCount: number;
  slug: string;
  title: string;
  topic: string;
}

interface SubjectSectionPayload {
  authors: Array<{ name: string }>;
  body: string;
  category: string;
  contentHash: string;
  date: number;
  description?: string;
  grade: string;
  locale: Locale;
  material: string;
  section: string;
  slug: string;
  subject?: string;
  title: string;
  topic: string;
  topicSlug: string;
}

export const syncSubjectTopics = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> => {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- SUBJECT TOPICS ---\n");
  }

  const pattern = options.locale
    ? `subject/**/_data/${options.locale}-material.ts`
    : "subject/**/_data/*-material.ts";
  const materialFiles = await globFiles(pattern);

  if (!options.quiet) {
    log(`Material files found: ${materialFiles.length}`);
  }

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const topics: SubjectTopicPayload[] = [];
  const errors: string[] = [];

  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(
        LOCALE_SUBJECT_MATERIAL_FILE_REGEX
      );
      if (!localeMatch) {
        continue;
      }

      const locale = parseLocale(localeMatch[1], materialFile);
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
    log(`Topics parsed: ${topics.length}`);
  }

  const totalBatches = Math.ceil(topics.length / BATCH_SIZES.subjectTopics);
  const progress = createBatchProgress(
    topics.length,
    BATCH_SIZES.subjectTopics
  );

  for (
    let index = 0;
    index < topics.length;
    index += BATCH_SIZES.subjectTopics
  ) {
    const batch = topics.slice(index, index + BATCH_SIZES.subjectTopics);
    const batchNum = Math.floor(index / BATCH_SIZES.subjectTopics) + 1;

    if (!options.quiet) {
      log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));
    }

    const result = await runConvexMutation(
      config,
      "contentSync/mutations/subjects:bulkSyncSubjectTopics",
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

  if (!options.quiet) {
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
  }

  return { ...totals, durationMs, itemsPerSecond };
};

export const syncSubjectSections = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> => {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- SUBJECT SECTIONS ---\n");
  }

  const pattern = options.locale
    ? `subject/**/${options.locale}.mdx`
    : "subject/**/*.mdx";
  const files = await globFiles(pattern);

  if (!options.quiet) {
    log(`Files found: ${files.length}`);
  }

  const totals: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    authorLinksCreated: 0,
  };
  const sections: SubjectSectionPayload[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const pathInfo = parseSubjectPath(file);
      const { metadata, body } = await readMdxFile(file);
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
        contentHash: computeHash(body + JSON.stringify(metadata.authors)),
        authors: metadata.authors,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${file}: ${message}`);
    }
  }

  if (errors.length > 0 && !options.quiet) {
    log(`Parse errors: ${errors.length}`);
    for (const error of errors) {
      logError(error);
    }
  }

  const totalBatches = Math.ceil(sections.length / BATCH_SIZES.subjectSections);
  const progress = createBatchProgress(
    sections.length,
    BATCH_SIZES.subjectSections
  );

  for (
    let index = 0;
    index < sections.length;
    index += BATCH_SIZES.subjectSections
  ) {
    const batch = sections.slice(index, index + BATCH_SIZES.subjectSections);
    const batchNum = Math.floor(index / BATCH_SIZES.subjectSections) + 1;

    if (!options.quiet) {
      log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));
    }

    const result = await runConvexMutation(
      config,
      "contentSync/mutations/subjects:bulkSyncSubjectSections",
      { sections: batch }
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    totals.skipped = (totals.skipped || 0) + (result.skipped || 0);
    totals.authorLinksCreated =
      (totals.authorLinksCreated || 0) + (result.authorLinksCreated || 0);
    updateBatchProgress(progress, batch.length);
  }

  const processed =
    totals.created + totals.updated + totals.unchanged + (totals.skipped || 0);
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (!options.quiet) {
    log(
      `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    if (totals.skipped) {
      log(`Skipped: ${totals.skipped} sections with missing topics`);
    }
    if (totals.authorLinksCreated) {
      log(`Related: ${totals.authorLinksCreated} author links`);
    }
    log(
      `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
    );

    if (processed === sections.length) {
      logSuccess(`${processed}/${files.length} files synced`);
    } else {
      logError(`Mismatch: ${processed} processed vs ${sections.length} parsed`);
    }
  }

  return { ...totals, durationMs, itemsPerSecond };
};
