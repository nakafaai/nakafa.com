import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

interface SyncedSubjectTopic {
  category: Doc<"subjectTopics">["category"];
  contentHash: string;
  description?: string;
  grade: Doc<"subjectTopics">["grade"];
  locale: Doc<"subjectTopics">["locale"];
  material: Doc<"subjectTopics">["material"];
  order: number;
  sectionCount: number;
  slug: string;
  title: string;
  topic: string;
}

interface SyncedSubjectSection {
  authors: Array<{ name: string }>;
  body: string;
  category: Doc<"subjectSections">["category"];
  contentHash: string;
  date: number;
  description?: string;
  grade: Doc<"subjectSections">["grade"];
  locale: Doc<"subjectSections">["locale"];
  material: Doc<"subjectSections">["material"];
  order: number;
  section: string;
  slug: string;
  subject?: string;
  title: string;
  topic: string;
  topicSlug: string;
}

const TOPIC_SLUG = "subject/high-school/10/mathematics/metadata-topic";
const SECTION_SLUG = `${TOPIC_SLUG}/metadata-section`;
const TOPIC_CONTENT_ID = getGraphContentId(TOPIC_SLUG);
const SECTION_CONTENT_ID = getGraphContentId(SECTION_SLUG);
const BASE_TOPIC: SyncedSubjectTopic = {
  category: "high-school",
  contentHash: "same-topic-hash",
  description: "Old topic description",
  grade: "10",
  locale: "id",
  material: "mathematics",
  order: 1,
  sectionCount: 1,
  slug: TOPIC_SLUG,
  title: "Old Topic Title",
  topic: "metadata-topic",
};
const BASE_SECTION: SyncedSubjectSection = {
  authors: [{ name: "Ada" }],
  body: "Subject body",
  category: "high-school",
  contentHash: "same-subject-hash",
  date: 1,
  description: "Old subject description",
  grade: "10",
  locale: "id",
  material: "mathematics",
  order: 2,
  section: "metadata-section",
  slug: SECTION_SLUG,
  subject: "Old subject",
  title: "Old Subject Title",
  topic: "metadata-topic",
  topicSlug: TOPIC_SLUG,
};

/** Builds a complete subject topic sync payload with focused overrides. */
function buildTopic(
  overrides: Partial<SyncedSubjectTopic> = {}
): SyncedSubjectTopic {
  return { ...BASE_TOPIC, ...overrides };
}

/** Builds a complete subject section sync payload with focused overrides. */
function buildSection(
  overrides: Partial<SyncedSubjectSection> = {}
): SyncedSubjectSection {
  return { ...BASE_SECTION, ...overrides };
}

/** Returns the graph asset ID for a subject route fixture. */
function getGraphContentId(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return identity.assetId;
}

describe("contentSync/mutations/subjects", () => {
  it("syncs subject topics through create, unchanged, and update paths", async () => {
    const t = convexTest(schema, convexModules);

    const created = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      { topics: [buildTopic()] }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      { topics: [buildTopic()] }
    );
    const updated = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      {
        topics: [
          buildTopic({
            contentHash: "new-topic-hash",
            description: "New topic description",
            order: 3,
            sectionCount: 2,
            title: "New Topic Title",
          }),
        ],
      }
    );
    const topic = await t.query(async (ctx) => {
      const syncedTopic = await ctx.db
        .query("subjectTopics")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", TOPIC_SLUG)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", TOPIC_CONTENT_ID))
        .unique();

      return { route, topic: syncedTopic };
    });

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(updated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(topic.topic).toMatchObject({
      description: "New topic description",
      order: 3,
      sectionCount: 2,
      title: "New Topic Title",
    });
    expect(topic.route).toMatchObject({
      contentHash: "new-topic-hash",
      kind: "subject-topic",
      markdown: false,
      route: TOPIC_SLUG,
      title: "New Topic Title",
    });
  });

  it("syncs subject sections, skips missing topics, and updates rendered metadata", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
    });
    await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      { topics: [buildTopic()] }
    );

    const created = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      {
        sections: [
          buildSection({ topicSlug: "subject/high-school/10/missing" }),
          buildSection(),
        ],
      }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      { sections: [buildSection()] }
    );
    const updated = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      {
        sections: [
          buildSection({
            date: 2,
            description: "New subject description",
            order: 4,
            subject: undefined,
            title: "New Subject Title",
          }),
        ],
      }
    );
    const snapshot = await t.query(async (ctx) => {
      const section = await ctx.db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", SECTION_SLUG)
        )
        .unique();

      if (!section) {
        throw new Error("Expected synced subject section.");
      }

      const authorLinks = await ctx.db
        .query("contentAuthors")
        .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
          q.eq("contentId", section._id).eq("contentType", "subject")
        )
        .collect();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();
      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();

      return { audioSource, authorLinks, route, search, section };
    });

    expect(created).toEqual({
      authorLinksCreated: 1,
      created: 1,
      skipped: 1,
      skippedTopicSlugs: ["subject/high-school/10/missing"],
      unchanged: 0,
      updated: 0,
    });
    expect(unchanged).toMatchObject({ unchanged: 1 });
    expect(updated).toMatchObject({ authorLinksCreated: 1, updated: 1 });
    expect(snapshot.section).toMatchObject({
      date: 2,
      description: "New subject description",
      order: 4,
      title: "New Subject Title",
    });
    expect(snapshot.section.subject).toBeUndefined();
    expect(snapshot.authorLinks).toHaveLength(1);
    expect(snapshot.search).toMatchObject({
      contentHash: "same-subject-hash",
      route: SECTION_SLUG,
      text: "New Subject Title New subject description Subject body",
      title: "New Subject Title",
    });
    expect(snapshot.search?.text).not.toContain("subject/high-school");
    expect(snapshot.search?.text).not.toContain("metadata-topic");
    expect(snapshot.route).toMatchObject({
      contentHash: "same-subject-hash",
      kind: "subject-section",
      route: SECTION_SLUG,
      title: "New Subject Title",
    });
    expect(snapshot.audioSource).toMatchObject({
      contentHash: "same-subject-hash",
      content_id: SECTION_CONTENT_ID,
      contentType: "subject",
      route: SECTION_SLUG,
    });
  });

  it("returns empty summaries for empty subject sync and stale delete batches", async () => {
    const t = convexTest(schema, convexModules);

    const topicSync = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      { topics: [] }
    );
    const sectionSync = await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      { sections: [] }
    );
    const topicDelete = await t.mutation(
      internal.contentSync.mutations.subjects.deleteStaleSubjectTopics,
      { topicIds: [] }
    );
    const sectionDelete = await t.mutation(
      internal.contentSync.mutations.subjects.deleteStaleSubjectSections,
      { sectionIds: [] }
    );

    expect(topicSync).toEqual({ created: 0, unchanged: 0, updated: 0 });
    expect(sectionSync).toEqual({
      authorLinksCreated: 0,
      created: 0,
      skipped: 0,
      skippedTopicSlugs: [],
      unchanged: 0,
      updated: 0,
    });
    expect(topicDelete).toEqual({ deleted: 0 });
    expect(sectionDelete).toEqual({ deleted: 0 });
  });

  it("deletes stale subject sections and skips IDs that already disappeared", async () => {
    const t = convexTest(schema, convexModules);
    const detachedSectionId = `${SECTION_CONTENT_ID}:catalog`;

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
    });
    await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      { topics: [buildTopic()] }
    );
    await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      { sections: [buildSection()] }
    );
    const ids = await t.mutation(async (ctx) => {
      const section = await ctx.db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", SECTION_SLUG)
        )
        .unique();
      const topic = await ctx.db
        .query("subjectTopics")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", TOPIC_SLUG)
        )
        .unique();

      if (!(section && topic)) {
        throw new Error("Expected synced subject section before stale delete.");
      }

      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();

      if (!audioSource) {
        throw new Error("Expected synced subject section audio source.");
      }

      const missingId = await ctx.db.insert("subjectSections", {
        body: "Missing body",
        category: "high-school",
        contentHash: "missing-hash",
        date: 1,
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 9,
        section: "missing",
        slug: "subject/high-school/10/mathematics/metadata-topic/missing",
        syncedAt: 1,
        title: "Missing",
        topic: "metadata-topic",
        topicId: topic._id,
      });
      await ctx.db.patch("audioContentSources", audioSource._id, {
        assetId: detachedSectionId,
        content_id: detachedSectionId,
      });
      await ctx.db.delete("subjectSections", missingId);

      return { missingId, sectionId: section._id };
    });

    const result = await t.mutation(
      internal.contentSync.mutations.subjects.deleteStaleSubjectSections,
      { sectionIds: [ids.sectionId, ids.missingId] }
    );
    const snapshot = await t.query(async (ctx) => {
      const section = await ctx.db.get(ids.sectionId);
      const authorLinks = await ctx.db
        .query("contentAuthors")
        .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
          q.eq("contentId", ids.sectionId).eq("contentType", "subject")
        )
        .collect();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();
      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", detachedSectionId)
        )
        .unique();

      return { audioSource, authorLinks, route, search, section };
    });

    expect(result).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      audioSource: null,
      authorLinks: [],
      route: null,
      search: null,
      section: null,
    });
  });

  it("deletes stale subject topics with their sections and rejects unsafe section counts", async () => {
    const t = convexTest(schema, convexModules);
    const detachedTopicId = `${TOPIC_CONTENT_ID}:catalog`;
    const detachedSectionId = `${SECTION_CONTENT_ID}:catalog`;

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
    });
    await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      { topics: [buildTopic(), buildTopic({ slug: `${TOPIC_SLUG}-unsafe` })] }
    );
    await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      { sections: [buildSection()] }
    );
    const ids = await t.mutation(async (ctx) => {
      const topic = await ctx.db
        .query("subjectTopics")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", TOPIC_SLUG)
        )
        .unique();
      const unsafeTopic = await ctx.db
        .query("subjectTopics")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", `${TOPIC_SLUG}-unsafe`)
        )
        .unique();
      const missingId = await ctx.db.insert("subjectTopics", {
        category: "high-school",
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 9,
        sectionCount: 0,
        slug: `${TOPIC_SLUG}-missing`,
        syncedAt: 1,
        title: "Missing",
        topic: "missing",
      });

      if (!(topic && unsafeTopic)) {
        throw new Error("Expected synced subject topics before stale delete.");
      }

      const topicRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", TOPIC_CONTENT_ID))
        .unique();
      const sectionRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();
      const sectionSearch = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();
      const sectionAudio = await ctx.db
        .query("audioContentSources")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_CONTENT_ID)
        )
        .unique();

      if (!(topicRoute && sectionRoute && sectionSearch && sectionAudio)) {
        throw new Error("Expected synced subject projections.");
      }

      await ctx.db.patch("contentRoutes", topicRoute._id, {
        assetId: detachedTopicId,
        content_id: detachedTopicId,
      });
      await ctx.db.patch("contentRoutes", sectionRoute._id, {
        assetId: detachedSectionId,
        content_id: detachedSectionId,
      });
      await ctx.db.patch("contentSearch", sectionSearch._id, {
        assetId: detachedSectionId,
        content_id: detachedSectionId,
      });
      await ctx.db.patch("audioContentSources", sectionAudio._id, {
        assetId: detachedSectionId,
        content_id: detachedSectionId,
      });
      await ctx.db.patch("subjectTopics", unsafeTopic._id, { sectionCount: 0 });
      await ctx.db.insert("subjectSections", {
        body: "Unsafe body",
        category: "high-school",
        contentHash: "unsafe-hash",
        date: 1,
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 9,
        section: "unsafe",
        slug: `${TOPIC_SLUG}-unsafe/unsafe`,
        syncedAt: 1,
        title: "Unsafe",
        topic: "metadata-topic",
        topicId: unsafeTopic._id,
      });
      await ctx.db.delete("subjectTopics", missingId);

      return { missingId, topicId: topic._id, unsafeTopicId: unsafeTopic._id };
    });

    await expect(
      t.mutation(
        internal.contentSync.mutations.subjects.deleteStaleSubjectTopics,
        { topicIds: [ids.unsafeTopicId] }
      )
    ).rejects.toThrow("CONTENT_SYNC_SECTION_COUNT_EXCEEDED");

    const result = await t.mutation(
      internal.contentSync.mutations.subjects.deleteStaleSubjectTopics,
      { topicIds: [ids.topicId, ids.missingId] }
    );
    const snapshot = await t.query(async (ctx) => {
      const topic = await ctx.db.get(ids.topicId);
      const section = await ctx.db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", SECTION_SLUG)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", detachedSectionId)
        )
        .unique();
      const topicRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", detachedTopicId))
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", detachedSectionId)
        )
        .unique();
      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", detachedSectionId)
        )
        .unique();

      return { audioSource, route, search, section, topic, topicRoute };
    });

    expect(result).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      audioSource: null,
      route: null,
      search: null,
      section: null,
      topic: null,
      topicRoute: null,
    });
  });
});
