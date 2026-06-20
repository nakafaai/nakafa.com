import { internal } from "@repo/backend/convex/_generated/api";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import {
  computeHash,
  parseDateToEpoch,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import { parseMaterialLessonPath } from "@repo/backend/scripts/lib/mdx-parser/paths";
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
import { readPublicContentPath } from "@repo/backend/scripts/sync-content/publicRoutes";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  BATCH_SIZES,
  CurriculumLessonSyncResultSchema,
  CurriculumTopicSyncResultSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import { listLessonRows } from "@repo/contents/_types/material/registry";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

/** Payload accepted by the Convex bulk topic sync mutation. */
type CurriculumTopicPayload = FunctionArgs<
  typeof internal.contentSync.mutations.curriculum.bulkSyncCurriculumTopics
>["topics"][number];

/** Payload accepted by the Convex bulk curriculum lesson sync mutation. */
type CurriculumLessonPayload = FunctionArgs<
  typeof internal.contentSync.mutations.curriculum.bulkSyncCurriculumLessons
>["sections"][number];

/** Material-authored section order used to validate curriculum lesson navigation. */
interface CurriculumLessonOrder {
  material: CurriculumTopicPayload["material"];
  order: number;
  topic: string;
  topicSlug: string;
}

/** Projects curriculum-owned placement data into the curriculum read model. */
const listSyncCurriculumTopics = Effect.fn("sync.listCurriculumTopics")(
  (locale?: SyncOptions["locale"]) =>
    Effect.succeed(
      listLessonRows(locale).map((topic) => ({
        ...topic,
        material: topic.domain,
      }))
    )
);

/** Syncs curriculum topic metadata from typed Material sources into Convex. */
export const syncCurriculumTopics = Effect.fn("sync.curriculumTopics")(
  function* (config: ConvexConfig, options: SyncOptions) {
    const startTime = performance.now();
    if (!options.quiet) {
      log("\n--- CURRICULUM TOPICS ---\n");
    }

    const materialTopics = yield* listSyncCurriculumTopics(options.locale);

    if (!options.quiet) {
      log(`Material topics found: ${materialTopics.length}`);
    }

    const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };
    const sectionCountByTopicSlug =
      yield* readMaterialListedCurriculumLessonCountByTopicSlug(options);
    const topics: CurriculumTopicPayload[] = yield* Effect.forEach(
      materialTopics,
      (topic) =>
        Effect.gen(function* () {
          const publicPath = yield* readPublicContentPath(
            topic.slug,
            topic.locale
          );
          const sectionCount =
            sectionCountByTopicSlug.get(`${topic.locale}:${topic.slug}`) ?? 0;

          return {
            locale: topic.locale,
            slug: topic.slug,
            publicPath,
            contentHash: computeHash(
              JSON.stringify({
                description: topic.description,
                locale: topic.locale,
                material: topic.material,
                order: topic.order,
                publicPath,
                sectionCount,
                slug: topic.slug,
                title: topic.title,
                topic: topic.topic,
              })
            ),
            material: topic.material,
            order: topic.order,
            topic: topic.topic,
            title: topic.title,
            description: topic.description,
            sectionCount,
          };
        })
    );

    if (!options.quiet) {
      log(`Topics parsed: ${topics.length}`);
    }

    const totalBatches = Math.ceil(
      topics.length / BATCH_SIZES.curriculumTopics
    );
    const progress = createBatchProgress(
      topics.length,
      BATCH_SIZES.curriculumTopics
    );

    for (
      let index = 0;
      index < topics.length;
      index += BATCH_SIZES.curriculumTopics
    ) {
      const batch = topics.slice(index, index + BATCH_SIZES.curriculumTopics);
      const batchNum = Math.floor(index / BATCH_SIZES.curriculumTopics) + 1;

      if (!options.quiet) {
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.curriculum.bulkSyncCurriculumTopics,
        { topics: batch },
        CurriculumTopicSyncResultSchema
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
        logSuccess(`${processed} curriculum topics synced`);
      } else {
        logError(`Mismatch: ${processed} processed vs ${topics.length} parsed`);
      }
    }

    return { ...totals, durationMs, itemsPerSecond };
  }
);

/** Syncs curriculum lesson MDX files into Convex. */
export const syncCurriculumLessons = Effect.fn("sync.curriculumLessons")(
  function* (config: ConvexConfig, options: SyncOptions) {
    const startTime = performance.now();
    if (!options.quiet) {
      log("\n--- CURRICULUM LESSONS ---\n");
    }

    const pattern = options.locale
      ? `material/lesson/**/${options.locale}.mdx`
      : "material/lesson/**/*.mdx";
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
    const sections: CurriculumLessonPayload[] = [];
    const errors: string[] = [];
    const placementIndex = yield* readCurriculumLessonPlacementIndex(options);

    for (const file of files) {
      const result = yield* Effect.either(
        Effect.gen(function* () {
          const pathInfo = yield* parseMaterialLessonPath(file);
          const sectionOrder = placementIndex.orderBySlug.get(
            `${pathInfo.locale}:${pathInfo.slug}`
          );

          if (!sectionOrder) {
            const topicSlug = getMaterialTopicSlug(pathInfo);
            if (
              !placementIndex.mappedTopicBySlug.has(
                `${pathInfo.locale}:${topicSlug}`
              )
            ) {
              return null;
            }

            return yield* Effect.fail(
              new ScriptFailureError({
                message: `Missing curriculum lesson order for ${pathInfo.locale}:${pathInfo.slug}. Add this section to the typed Material source before syncing the mapped curriculum topic.`,
              })
            );
          }

          const { metadata, body } = yield* readMdxFile(file);
          if (sectionOrder.topic !== pathInfo.topic) {
            return yield* Effect.fail(
              new ScriptFailureError({
                message: `Material lesson order for ${pathInfo.locale}:${pathInfo.slug} points at ${sectionOrder.topic}, expected ${pathInfo.topic}.`,
              })
            );
          }

          const date = yield* parseDateToEpoch(metadata.date);
          const publicPath = yield* readPublicContentPath(
            pathInfo.slug,
            pathInfo.locale
          );
          const contentHash = computeHash(
            JSON.stringify({
              authors: metadata.authors,
              body,
              date,
              description: metadata.description,
              locale: pathInfo.locale,
              material: sectionOrder.material,
              order: sectionOrder.order,
              publicPath,
              section: pathInfo.section,
              slug: pathInfo.slug,
              subject: metadata.subject,
              title: metadata.title,
              topic: sectionOrder.topic,
              topicSlug: sectionOrder.topicSlug,
            })
          );

          return {
            locale: pathInfo.locale,
            slug: pathInfo.slug,
            publicPath,
            topicSlug: sectionOrder.topicSlug,
            material: sectionOrder.material,
            order: sectionOrder.order,
            topic: sectionOrder.topic,
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
      } else if (result.right) {
        sections.push(result.right);
      }
    }

    if (errors.length > 0 && !options.quiet) {
      log(`Parse errors: ${errors.length}`);
      for (const error of errors) {
        logError(error);
      }
    }

    if (errors.length > 0) {
      return yield* failCurriculumParseErrors("sections", errors);
    }

    const totalBatches = Math.ceil(
      sections.length / BATCH_SIZES.curriculumLessons
    );
    const progress = createBatchProgress(
      sections.length,
      BATCH_SIZES.curriculumLessons
    );

    for (
      let index = 0;
      index < sections.length;
      index += BATCH_SIZES.curriculumLessons
    ) {
      const batch = sections.slice(
        index,
        index + BATCH_SIZES.curriculumLessons
      );
      const batchNum = Math.floor(index / BATCH_SIZES.curriculumLessons) + 1;

      if (!options.quiet) {
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.curriculum.bulkSyncCurriculumLessons,
        { sections: batch },
        CurriculumLessonSyncResultSchema
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
      totals.created +
      totals.updated +
      totals.unchanged +
      (totals.skipped || 0);
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
        logError(
          `Mismatch: ${processed} processed vs ${sections.length} parsed`
        );
      }
    }

    return { ...totals, durationMs, itemsPerSecond };
  }
);

/** Reads authored curriculum lesson order for curriculum-mapped material only. */
const readCurriculumLessonPlacementIndex = Effect.fn(
  "sync.readCurriculumLessonPlacementIndex"
)(function* (options: SyncOptions) {
  const orderBySlug = new Map<string, CurriculumLessonOrder>();
  const mappedTopicBySlug = new Set<string>();
  const topics = yield* listSyncCurriculumTopics(options.locale);

  for (const topic of topics) {
    mappedTopicBySlug.add(`${topic.locale}:${topic.slug}`);

    for (const section of topic.sections) {
      const key = `${topic.locale}:${section.slug}`;

      if (orderBySlug.has(key)) {
        return yield* Effect.fail(
          new ScriptFailureError({
            message: `Duplicate curriculum lesson material order for ${key}.`,
          })
        );
      }

      orderBySlug.set(key, {
        material: topic.material,
        order: section.order,
        topic: topic.topic,
        topicSlug: topic.slug,
      });
    }
  }

  return { mappedTopicBySlug, orderBySlug };
});

/** Counts existing lesson MDX files that are listed in authored material order. */
const readMaterialListedCurriculumLessonCountByTopicSlug = Effect.fn(
  "sync.readMaterialListedCurriculumLessonCountByTopicSlug"
)(function* (options: SyncOptions) {
  const placementIndex = yield* readCurriculumLessonPlacementIndex(options);
  const pattern = options.locale
    ? `material/lesson/**/${options.locale}.mdx`
    : "material/lesson/**/*.mdx";
  const files = yield* globFiles(pattern);
  const counts = new Map<string, number>();
  const errors: string[] = [];

  for (const file of files) {
    const result = yield* Effect.either(parseMaterialLessonPath(file));

    if (result._tag === "Left") {
      const message =
        result.left instanceof Error
          ? result.left.message
          : String(result.left);
      errors.push(`${file}: ${message}`);
      continue;
    }

    const pathInfo = result.right;
    const sectionOrder = placementIndex.orderBySlug.get(
      `${pathInfo.locale}:${pathInfo.slug}`
    );

    if (!sectionOrder) {
      const topicSlug = getMaterialTopicSlug(pathInfo);
      if (
        !placementIndex.mappedTopicBySlug.has(`${pathInfo.locale}:${topicSlug}`)
      ) {
        continue;
      }

      errors.push(
        `${file}: Missing curriculum lesson order for ${pathInfo.locale}:${pathInfo.slug}. Add this section to the typed Material source before syncing the mapped curriculum topic.`
      );
      continue;
    }

    if (sectionOrder.topic !== pathInfo.topic) {
      errors.push(
        `${file}: Material lesson order for ${pathInfo.locale}:${pathInfo.slug} points at ${sectionOrder.topic}, expected ${pathInfo.topic}.`
      );
      continue;
    }

    const countKey = `${pathInfo.locale}:${sectionOrder.topicSlug}`;
    counts.set(countKey, (counts.get(countKey) ?? 0) + 1);
  }

  if (errors.length > 0) {
    return yield* failCurriculumParseErrors("topic section counts", errors);
  }

  return counts;
});

/** Rebuilds the material topic source slug used by curriculum mapping validation. */
function getMaterialTopicSlug(pathInfo: { material: string; topic: string }) {
  return `material/lesson/${pathInfo.material}/${pathInfo.topic}`;
}

/** Fails curriculum sync before partial ordered navigation data can be published. */
function failCurriculumParseErrors(kind: string, errors: readonly string[]) {
  return Effect.fail(
    new ScriptFailureError({
      message: `Cannot sync curriculum ${kind} with invalid material lesson data:\n${errors.join("\n")}`,
    })
  );
}
