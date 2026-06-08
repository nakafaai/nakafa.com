import { updateContentAudioHash } from "@repo/backend/convex/audioStudies/contentAudios/impl";
import { syncAudioContentSource } from "@repo/backend/convex/audioStudies/helpers/sources";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  buildAuthorCache,
  deleteSubjectSection,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
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

const syncedSubjectTopicValidator = v.object({
  category: subjectCategoryValidator,
  description: v.optional(v.string()),
  grade: gradeValidator,
  locale: localeValidator,
  material: materialValidator,
  sectionCount: v.number(),
  slug: v.string(),
  title: v.string(),
  topic: v.string(),
});

const syncedSubjectSectionValidator = v.object({
  authors: v.array(v.object({ name: v.string() })),
  body: v.string(),
  category: subjectCategoryValidator,
  contentHash: v.string(),
  date: v.number(),
  description: v.optional(v.string()),
  grade: gradeValidator,
  locale: localeValidator,
  material: materialValidator,
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

/** Upsert subject topics from the filesystem sync source. */
export const bulkSyncSubjectTopics = internalMutation({
  args: {
    topics: v.array(syncedSubjectTopicValidator),
  },
  returns: syncSummaryValidator,
  /** Applies one bounded subject topic sync batch. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncSubjectTopics",
      limit: CONTENT_SYNC_BATCH_LIMITS.subjectTopics,
      received: args.topics.length,
      unit: "topics",
    });

    const now = Date.now();
    let created = 0;
    let unchanged = 0;
    let updated = 0;

    for (const topic of args.topics) {
      const nextValues = {
        category: topic.category,
        description: topic.description,
        grade: topic.grade,
        material: topic.material,
        sectionCount: topic.sectionCount,
        title: topic.title,
        topic: topic.topic,
      };

      const existingTopic = await ctx.db
        .query("subjectTopics")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", topic.locale).eq("slug", topic.slug)
        )
        .unique();

      if (hasSameSyncValues(nextValues, existingTopic)) {
        unchanged++;
        continue;
      }

      if (existingTopic) {
        await ctx.db.patch("subjectTopics", existingTopic._id, {
          ...nextValues,
          syncedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("subjectTopics", {
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

/** Upsert subject sections and author links from the filesystem sync source. */
export const bulkSyncSubjectSections = internalMutation({
  args: {
    sections: v.array(syncedSubjectSectionValidator),
  },
  returns: syncSectionSummaryValidator,
  /** Applies one bounded subject section sync batch to runtime, search, author, and audio rows. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncSubjectSections",
      limit: CONTENT_SYNC_BATCH_LIMITS.subjectSections,
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
      const topic = await ctx.db
        .query("subjectTopics")
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
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", section.locale).eq("slug", section.slug)
        )
        .unique();

      await syncContentSearch(ctx, {
        contentHash: section.contentHash,
        description: section.description,
        locale: section.locale,
        route: section.slug,
        section: "subject",
        syncedAt: now,
        text: [
          section.category,
          section.grade,
          section.material,
          section.topic,
          section.section,
          section.subject,
          section.body,
        ]
          .filter(Boolean)
          .join(" "),
        title: section.title,
      });

      if (existingSection) {
        await syncAudioContentSource(ctx, {
          contentHash: section.contentHash,
          locale: section.locale,
          ref: { id: existingSection._id, type: "subject" },
          slug: section.slug,
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
        await ctx.db.patch("subjectSections", existingSection._id, {
          ...nextValues,
          syncedAt: now,
        });

        await runConvexProgram(
          updateContentAudioHash(ctx, {
            contentRef: { id: existingSection._id, type: "subject" },
            newHash: section.contentHash,
          })
        );

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          existingSection._id,
          "subject",
          section.authors,
          authorCache
        );

        updated++;
        continue;
      }

      const sectionId = await ctx.db.insert("subjectSections", {
        ...nextValues,
        locale: section.locale,
        slug: section.slug,
        syncedAt: now,
      });

      await syncAudioContentSource(ctx, {
        contentHash: section.contentHash,
        locale: section.locale,
        ref: { id: sectionId, type: "subject" },
        slug: section.slug,
        syncedAt: now,
      });

      authorLinksCreated += await syncContentAuthorsWithCache(
        ctx,
        sectionId,
        "subject",
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

/** Delete stale subject topics after their sections have been removed. */
export const deleteStaleSubjectTopics = internalMutation({
  args: {
    topicIds: v.array(v.id("subjectTopics")),
  },
  returns: deleteResultValidator,
  /** Removes one bounded stale subject topic batch after validating section counts. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteStaleSubjectTopics",
      limit: CONTENT_SYNC_BATCH_LIMITS.staleSubjectTopics,
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
        .query("subjectSections")
        .withIndex("by_topicId", (q) => q.eq("topicId", topicId))
        .take(topic.sectionCount + 1);

      if (sections.length > topic.sectionCount) {
        throw new ConvexError({
          code: "CONTENT_SYNC_SECTION_COUNT_EXCEEDED",
          message: "Subject section count exceeds the topic section count.",
        });
      }

      for (const section of sections) {
        await deleteSubjectSection(ctx, section._id);
      }

      await ctx.db.delete("subjectTopics", topicId);
      deleted++;
    }

    return { deleted };
  },
});

/** Delete stale subject sections together with sync-managed author links. */
export const deleteStaleSubjectSections = internalMutation({
  args: {
    sectionIds: v.array(v.id("subjectSections")),
  },
  returns: deleteResultValidator,
  /** Removes one bounded stale subject section batch and its sync-owned dependent rows. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteStaleSubjectSections",
      limit: CONTENT_SYNC_BATCH_LIMITS.staleSubjectSections,
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
      await deleteSubjectSection(ctx, sectionId);
      deleted++;
    }

    return { deleted };
  },
});
