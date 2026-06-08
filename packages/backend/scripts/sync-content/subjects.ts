import { internal } from "@repo/backend/convex/_generated/api";
import {
  computeHash,
  parseDateToEpoch,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import { parseSubjectMaterialFile } from "@repo/backend/scripts/lib/mdx-parser/materials";
import { parseSubjectPath } from "@repo/backend/scripts/lib/mdx-parser/paths";
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
  LOCALE_SUBJECT_MATERIAL_FILE_REGEX,
  parseLocale,
  SubjectSectionSyncResultSchema,
  SubjectTopicSyncResultSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type SubjectTopicPayload = FunctionArgs<
  typeof internal.contentSync.mutations.subjects.bulkSyncSubjectTopics
>["topics"][number];

type SubjectSectionPayload = FunctionArgs<
  typeof internal.contentSync.mutations.subjects.bulkSyncSubjectSections
>["sections"][number];

/** Syncs subject topic metadata from material files into Convex. */
export const syncSubjectTopics = Effect.fn("sync.subjectTopics")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- SUBJECT TOPICS ---\n");
  }

  const pattern = options.locale
    ? `subject/**/_data/${options.locale}-material.ts`
    : "subject/**/_data/*-material.ts";
  const materialFiles = yield* globFiles(pattern);

  if (!options.quiet) {
    log(`Material files found: ${materialFiles.length}`);
  }

  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
  const topics: SubjectTopicPayload[] = [];
  const errors: string[] = [];

  for (const materialFile of materialFiles) {
    const result = yield* Effect.either(
      Effect.gen(function* () {
        const localeMatch = materialFile.match(
          LOCALE_SUBJECT_MATERIAL_FILE_REGEX
        );
        if (!localeMatch) {
          return [];
        }

        const locale = yield* parseLocale(localeMatch[1], materialFile);
        const parsedTopics = yield* parseSubjectMaterialFile(
          materialFile,
          locale
        );

        return parsedTopics.map((topic) => ({
          locale: topic.locale,
          slug: topic.slug,
          category: topic.category,
          contentHash: computeHash(
            JSON.stringify({
              category: topic.category,
              description: topic.description,
              grade: topic.grade,
              locale: topic.locale,
              material: topic.material,
              sectionCount: topic.sectionCount,
              slug: topic.slug,
              title: topic.title,
              topic: topic.topic,
            })
          ),
          grade: topic.grade,
          material: topic.material,
          topic: topic.topic,
          title: topic.title,
          description: topic.description,
          sectionCount: topic.sectionCount,
        }));
      })
    );

    if (result._tag === "Left") {
      const message =
        result.left instanceof Error
          ? result.left.message
          : String(result.left);
      errors.push(`${materialFile}: ${message}`);
    } else {
      topics.push(...result.right);
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

    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      { topics: batch },
      SubjectTopicSyncResultSchema
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
});

/** Syncs subject lesson MDX files into Convex. */
export const syncSubjectSections = Effect.fn("sync.subjectSections")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- SUBJECT SECTIONS ---\n");
  }

  const pattern = options.locale
    ? `subject/**/${options.locale}.mdx`
    : "subject/**/*.mdx";
  const files = yield* globFiles(pattern);

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
    const result = yield* Effect.either(
      Effect.gen(function* () {
        const pathInfo = yield* parseSubjectPath(file);
        const { metadata, body } = yield* readMdxFile(file);
        const topicSlug = `subject/${pathInfo.category}/${pathInfo.grade}/${pathInfo.material}/${pathInfo.topic}`;
        const date = yield* parseDateToEpoch(metadata.date);
        const contentHash = computeHash(
          JSON.stringify({
            authors: metadata.authors,
            body,
            category: pathInfo.category,
            date,
            description: metadata.description,
            grade: pathInfo.grade,
            locale: pathInfo.locale,
            material: pathInfo.material,
            section: pathInfo.section,
            slug: pathInfo.slug,
            subject: metadata.subject,
            title: metadata.title,
            topic: pathInfo.topic,
            topicSlug,
          })
        );

        return {
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
          date,
          subject: metadata.subject,
          body,
          contentHash,
          authors: metadata.authors,
        };
      })
    );

    if (result._tag === "Left") {
      const message =
        result.left instanceof Error
          ? result.left.message
          : String(result.left);
      errors.push(`${file}: ${message}`);
    } else {
      sections.push(result.right);
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

    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      { sections: batch },
      SubjectSectionSyncResultSchema
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
});
