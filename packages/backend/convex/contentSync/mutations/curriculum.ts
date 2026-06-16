import { updateContentAudioHash } from "@repo/backend/convex/audioStudies/contentAudios/impl";
import { syncAudioContentSource } from "@repo/backend/convex/audioStudies/helpers/sources";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  buildAuthorCache,
  deleteContentProjectionsByRoute,
  deleteCurriculumLesson,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import { getContentGraphIdentity } from "@repo/backend/convex/contents/graph";
import { syncContentRoute } from "@repo/backend/convex/contents/helpers/routes/write";
import { syncContentSearch } from "@repo/backend/convex/contents/helpers/search/write";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import { ConvexError, v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const syncedCurriculumTopicValidator = v.object({
  category: subjectCategoryValidator,
  contentHash: v.string(),
  description: v.optional(v.string()),
  grade: gradeValidator,
  locale: localeValidator,
  material: materialValidator,
  order: v.number(),
  sectionCount: v.number(),
  slug: v.string(),
  title: v.string(),
  topic: v.string(),
});

const syncedCurriculumLessonValidator = v.object({
  authors: v.array(v.object({ name: v.string() })),
  body: v.string(),
  category: subjectCategoryValidator,
  contentHash: v.string(),
  date: v.number(),
  description: v.optional(v.string()),
  grade: gradeValidator,
  locale: localeValidator,
  material: materialValidator,
  order: v.number(),
  section: v.string(),
  slug: v.string(),
  subject: v.optional(v.string()),
  title: v.string(),
  topic: v.string(),
  topicSlug: v.string(),
});

const syncSummaryValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

const syncSectionSummaryValidator = v.object({
  authorLinksCreated: v.number(),
  created: v.number(),
  skipped: v.number(),
  skippedTopicSlugs: v.array(v.string()),
  unchanged: v.number(),
  updated: v.number(),
});

const deleteResultValidator = v.object({
  deleted: v.number(),
});

/** Upsert curriculum topics from the filesystem sync source. */
export const bulkSyncCurriculumTopics = internalMutation({
  args: {
    topics: v.array(syncedCurriculumTopicValidator),
  },
  returns: syncSummaryValidator,
  /** Applies one bounded curriculum topic sync batch. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurriculumTopics",
      limit: CONTENT_SYNC_BATCH_LIMITS.curriculumTopics,
      received: args.topics.length,
      unit: "topics",
    });

    const now = Date.now();
    let created = 0;
    let unchanged = 0;
    let updated = 0;

    for (const topic of args.topics) {
      const graph = getContentGraphIdentity({
        kind: "curriculum-topic",
        locale: topic.locale,
        route: topic.slug,
      });
      const nextValues = {
        category: topic.category,
        description: topic.description,
        grade: topic.grade,
        material: topic.material,
        order: topic.order,
        sectionCount: topic.sectionCount,
        title: topic.title,
        topic: topic.topic,
      };

      await syncContentRoute(ctx, {
        ...graph,
        contentHash: topic.contentHash,
        description: topic.description,
        kind: "curriculum-topic",
        locale: topic.locale,
        markdown: false,
        route: topic.slug,
        section: "material",
        syncedAt: now,
        title: topic.title,
      });

      const existingTopic = await ctx.db
        .query("curriculumTopics")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", topic.locale).eq("slug", topic.slug)
        )
        .unique();

      if (hasSameSyncValues(nextValues, existingTopic)) {
        unchanged++;
        continue;
      }

      if (existingTopic) {
        await ctx.db.patch("curriculumTopics", existingTopic._id, {
          ...nextValues,
          syncedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("curriculumTopics", {
        ...nextValues,
        locale: topic.locale,
        slug: topic.slug,
        syncedAt: now,
      });
      created++;
    }

    return { created, unchanged, updated };
  },
});

/** Upsert curriculum lessons and author links from the filesystem sync source. */
export const bulkSyncCurriculumLessons = internalMutation({
  args: {
    sections: v.array(syncedCurriculumLessonValidator),
  },
  returns: syncSectionSummaryValidator,
  /** Applies one bounded curriculum lesson sync batch to runtime, search, author, and audio rows. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurriculumLessons",
      limit: CONTENT_SYNC_BATCH_LIMITS.curriculumLessons,
      received: args.sections.length,
      unit: "sections",
    });

    const now = Date.now();
    let authorLinksCreated = 0;
    let created = 0;
    let skipped = 0;
    const skippedTopicSlugs = new Set<string>();
    let unchanged = 0;
    let updated = 0;

    const allAuthorNames = args.sections.flatMap((section) =>
      section.authors.map((author) => author.name)
    );
    const authorCache = await buildAuthorCache(ctx, allAuthorNames);

    for (const section of args.sections) {
      const graph = getContentGraphIdentity({
        kind: "curriculum-lesson",
        locale: section.locale,
        route: section.slug,
      });
      const topic = await ctx.db
        .query("curriculumTopics")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", section.locale).eq("slug", section.topicSlug)
        )
        .unique();

      if (!topic) {
        skipped++;
        skippedTopicSlugs.add(section.topicSlug);
        logger.warn(`Topic not found for section: ${section.slug}`);
        continue;
      }

      const existingSection = await ctx.db
        .query("curriculumLessons")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", section.locale).eq("slug", section.slug)
        )
        .unique();

      await syncContentSearch(ctx, {
        ...graph,
        contentHash: section.contentHash,
        description: section.description,
        locale: section.locale,
        route: section.slug,
        section: "material",
        syncedAt: now,
        text: section.body,
        title: section.title,
      });
      await syncContentRoute(ctx, {
        ...graph,
        authors: section.authors,
        contentHash: section.contentHash,
        date: section.date,
        description: section.description ?? section.subject,
        kind: "curriculum-lesson",
        locale: section.locale,
        markdown: true,
        route: section.slug,
        section: "material",
        syncedAt: now,
        title: section.title,
      });

      if (existingSection) {
        await syncAudioContentSource(ctx, {
          ...graph,
          content_id: graph.assetId,
          contentType: "material",
          contentHash: section.contentHash,
          locale: section.locale,
          route: section.slug,
          syncedAt: now,
        });
      }

      const nextValues = {
        body: section.body,
        category: section.category,
        contentHash: section.contentHash,
        date: section.date,
        description: section.description,
        grade: section.grade,
        material: section.material,
        order: section.order,
        section: section.section,
        subject: section.subject,
        title: section.title,
        topic: section.topic,
        topicId: topic._id,
      };

      if (hasSameSyncValues(nextValues, existingSection)) {
        unchanged++;
        continue;
      }

      if (existingSection) {
        await ctx.db.patch("curriculumLessons", existingSection._id, {
          ...nextValues,
          syncedAt: now,
        });

        await runConvexProgram(
          updateContentAudioHash(ctx, {
            content_id: graph.assetId,
            newHash: section.contentHash,
          })
        );

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          existingSection._id,
          "material",
          section.authors,
          authorCache
        );

        updated++;
        continue;
      }

      const sectionId = await ctx.db.insert("curriculumLessons", {
        ...nextValues,
        locale: section.locale,
        slug: section.slug,
        syncedAt: now,
      });

      await syncAudioContentSource(ctx, {
        ...graph,
        content_id: graph.assetId,
        contentType: "material",
        contentHash: section.contentHash,
        locale: section.locale,
        route: section.slug,
        syncedAt: now,
      });

      authorLinksCreated += await syncContentAuthorsWithCache(
        ctx,
        sectionId,
        "material",
        section.authors,
        authorCache
      );

      created++;
    }

    return {
      authorLinksCreated,
      created,
      skipped,
      skippedTopicSlugs: [...skippedTopicSlugs],
      unchanged,
      updated,
    };
  },
});

/** Delete stale curriculum topics after their sections have been removed. */
export const deleteStaleCurriculumTopics = internalMutation({
  args: {
    topicIds: v.array(v.id("curriculumTopics")),
  },
  returns: deleteResultValidator,
  /** Removes one bounded stale curriculum topic batch after validating section counts. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteStaleCurriculumTopics",
      limit: CONTENT_SYNC_BATCH_LIMITS.staleCurriculumTopics,
      received: args.topicIds.length,
      unit: "topic IDs",
    });

    if (args.topicIds.length === 0) {
      return { deleted: 0 };
    }

    const topics = await getAll(ctx.db, args.topicIds);
    let deleted = 0;

    for (const [index, topic] of topics.entries()) {
      if (!topic) {
        continue;
      }

      const topicId = args.topicIds[index];
      const sections = await ctx.db
        .query("curriculumLessons")
        .withIndex("by_topicId", (q) => q.eq("topicId", topicId))
        .take(CONTENT_SYNC_BATCH_LIMITS.staleCurriculumLessons + 1);

      if (
        sections.length > topic.sectionCount ||
        sections.length > CONTENT_SYNC_BATCH_LIMITS.staleCurriculumLessons
      ) {
        throw new ConvexError({
          code: "CONTENT_SYNC_SECTION_COUNT_EXCEEDED",
          message: "Curriculum lesson count exceeds the topic section count.",
        });
      }

      for (const section of sections) {
        await deleteCurriculumLesson(ctx, section._id);
      }

      await deleteContentProjectionsByRoute(ctx, {
        locale: topic.locale,
        route: topic.slug,
      });

      await ctx.db.delete("curriculumTopics", topicId);
      deleted++;
    }

    return { deleted };
  },
});

/** Delete stale curriculum lessons together with sync-managed author links. */
export const deleteStaleCurriculumLessons = internalMutation({
  args: {
    sectionIds: v.array(v.id("curriculumLessons")),
  },
  returns: deleteResultValidator,
  /** Removes one bounded stale curriculum lesson batch and its sync-owned dependent rows. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteStaleCurriculumLessons",
      limit: CONTENT_SYNC_BATCH_LIMITS.staleCurriculumLessons,
      received: args.sectionIds.length,
      unit: "section IDs",
    });

    if (args.sectionIds.length === 0) {
      return { deleted: 0 };
    }

    const sections = await getAll(ctx.db, args.sectionIds);
    let deleted = 0;

    for (const [index, section] of sections.entries()) {
      if (!section) {
        continue;
      }

      const sectionId = args.sectionIds[index];
      await deleteCurriculumLesson(ctx, sectionId);
      deleted++;
    }

    return { deleted };
  },
});
