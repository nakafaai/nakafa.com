import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type {
  Grade,
  Locale,
  Material,
  SubjectCategory,
} from "@repo/backend/confect/modules/content/content.schemas";
import { syncContentSearch } from "@repo/backend/confect/modules/content/contentSearch/writes.service";
import {
  assertContentSyncBatchSize,
  CONTENT_SYNC_BATCH_LIMITS,
  ContentSyncError,
} from "@repo/backend/confect/modules/content/contentSync.shared";
import {
  buildAuthorCache,
  deleteSubjectSection,
  resetAudioForContentHash,
  syncContentAuthorsWithCache,
} from "@repo/backend/confect/modules/content/contentSyncHelpers.service";
import { Clock, Effect } from "effect";

interface SyncedSubjectTopic {
  readonly category: SubjectCategory;
  readonly description?: string;
  readonly grade: Grade;
  readonly locale: Locale;
  readonly material: Material;
  readonly sectionCount: number;
  readonly slug: string;
  readonly title: string;
  readonly topic: string;
}

interface SyncedSubjectSection {
  readonly authors: readonly { readonly name: string }[];
  readonly body: string;
  readonly category: SubjectCategory;
  readonly contentHash: string;
  readonly date: number;
  readonly description?: string;
  readonly grade: Grade;
  readonly locale: Locale;
  readonly material: Material;
  readonly section: string;
  readonly slug: string;
  readonly subject?: string;
  readonly title: string;
  readonly topic: string;
  readonly topicSlug: string;
}

/** Upserts synced subject topic metadata. */
export const bulkSyncSubjectTopics = Effect.fn(
  "contentSync.subjects.bulkSyncSubjectTopics"
)(function* (args: { topics: SyncedSubjectTopic[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "bulkSyncSubjectTopics",
    limit: CONTENT_SYNC_BATCH_LIMITS.subjectTopics,
    received: args.topics.length,
    unit: "topics",
  });

  const now = yield* Clock.currentTimeMillis;
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
    const existingTopic = yield* Effect.promise(() =>
      ctx.db
        .query("subjectTopics")
        .withIndex("by_locale_and_slug", (query) =>
          query.eq("locale", topic.locale).eq("slug", topic.slug)
        )
        .unique()
    );

    if (
      existingTopic &&
      existingTopic.category === nextValues.category &&
      existingTopic.description === nextValues.description &&
      existingTopic.grade === nextValues.grade &&
      existingTopic.material === nextValues.material &&
      existingTopic.sectionCount === nextValues.sectionCount &&
      existingTopic.title === nextValues.title &&
      existingTopic.topic === nextValues.topic
    ) {
      unchanged += 1;
      continue;
    }

    if (existingTopic) {
      yield* Effect.promise(() =>
        ctx.db.patch(existingTopic._id, {
          ...nextValues,
          syncedAt: now,
        })
      );
      updated += 1;
      continue;
    }

    yield* Effect.promise(() =>
      ctx.db.insert("subjectTopics", {
        ...nextValues,
        locale: topic.locale,
        slug: topic.slug,
        syncedAt: now,
      })
    );
    created += 1;
  }

  return { created, unchanged, updated };
});

/** Upserts synced subject sections and linked author/search/audio rows. */
export const bulkSyncSubjectSections = Effect.fn(
  "contentSync.subjects.bulkSyncSubjectSections"
)(function* (args: { sections: SyncedSubjectSection[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "bulkSyncSubjectSections",
    limit: CONTENT_SYNC_BATCH_LIMITS.subjectSections,
    received: args.sections.length,
    unit: "sections",
  });

  const now = yield* Clock.currentTimeMillis;
  let authorLinksCreated = 0;
  let created = 0;
  let skipped = 0;
  const skippedTopicSlugs = new Set<string>();
  let unchanged = 0;
  let updated = 0;
  const allAuthorNames = args.sections.flatMap((section) =>
    section.authors.map((author) => author.name)
  );
  const authorCache = yield* buildAuthorCache(ctx, allAuthorNames);

  for (const section of args.sections) {
    const topic = yield* Effect.promise(() =>
      ctx.db
        .query("subjectTopics")
        .withIndex("by_locale_and_slug", (query) =>
          query.eq("locale", section.locale).eq("slug", section.topicSlug)
        )
        .unique()
    );

    if (!topic) {
      skipped += 1;
      skippedTopicSlugs.add(section.topicSlug);
      yield* Effect.logWarning(`Topic not found for section: ${section.slug}`);
      continue;
    }

    const existingSection = yield* Effect.promise(() =>
      ctx.db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (query) =>
          query.eq("locale", section.locale).eq("slug", section.slug)
        )
        .unique()
    );
    yield* syncContentSearch({
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

    if (existingSection?.contentHash === section.contentHash) {
      unchanged += 1;
      continue;
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

    if (existingSection) {
      yield* Effect.promise(() =>
        ctx.db.patch(existingSection._id, {
          ...nextValues,
          syncedAt: now,
        })
      );
      yield* resetAudioForContentHash({
        contentRef: { id: existingSection._id, type: "subject" },
        newHash: section.contentHash,
      });
      authorLinksCreated += yield* syncContentAuthorsWithCache(
        ctx,
        existingSection._id,
        "subject",
        section.authors,
        authorCache
      );
      updated += 1;
      continue;
    }

    const sectionId = yield* Effect.promise(() =>
      ctx.db.insert("subjectSections", {
        ...nextValues,
        locale: section.locale,
        slug: section.slug,
        syncedAt: now,
      })
    );
    authorLinksCreated += yield* syncContentAuthorsWithCache(
      ctx,
      sectionId,
      "subject",
      section.authors,
      authorCache
    );
    created += 1;
  }

  return {
    authorLinksCreated,
    created,
    skipped,
    skippedTopicSlugs: [...skippedTopicSlugs],
    unchanged,
    updated,
  };
});

/** Deletes stale subject topics and their bounded child sections. */
export const deleteStaleSubjectTopics = Effect.fn(
  "contentSync.subjects.deleteStaleSubjectTopics"
)(function* (args: { topicIds: Id<"subjectTopics">[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "deleteStaleSubjectTopics",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleSubjectTopics,
    received: args.topicIds.length,
    unit: "topic IDs",
  });

  let deleted = 0;

  for (const topicId of args.topicIds) {
    const topic = yield* Effect.promise(() => ctx.db.get(topicId));

    if (!topic) {
      continue;
    }

    const sections = yield* Effect.promise(() =>
      ctx.db
        .query("subjectSections")
        .withIndex("by_topicId", (query) => query.eq("topicId", topicId))
        .take(topic.sectionCount + 1)
    );

    if (sections.length > topic.sectionCount) {
      return yield* Effect.fail(
        new ContentSyncError({
          message: "Subject section count exceeds the topic section count.",
        })
      );
    }

    for (const section of sections) {
      yield* deleteSubjectSection(ctx, section._id);
    }

    yield* Effect.promise(() => ctx.db.delete(topicId));
    deleted += 1;
  }

  return { deleted };
});

/** Deletes stale subject sections. */
export const deleteStaleSubjectSections = Effect.fn(
  "contentSync.subjects.deleteStaleSubjectSections"
)(function* (args: { sectionIds: Id<"subjectSections">[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "deleteStaleSubjectSections",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleSubjectSections,
    received: args.sectionIds.length,
    unit: "section IDs",
  });

  let deleted = 0;

  for (const sectionId of args.sectionIds) {
    const section = yield* Effect.promise(() => ctx.db.get(sectionId));

    if (!section) {
      continue;
    }

    yield* deleteSubjectSection(ctx, sectionId);
    deleted += 1;
  }

  return { deleted };
});
