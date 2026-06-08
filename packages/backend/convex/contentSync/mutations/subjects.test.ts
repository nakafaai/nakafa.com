import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

interface SyncedSubjectTopic {
  category: Doc<"subjectTopics">["category"];
  description?: string;
  grade: Doc<"subjectTopics">["grade"];
  locale: Doc<"subjectTopics">["locale"];
  material: Doc<"subjectTopics">["material"];
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
  section: string;
  slug: string;
  subject?: string;
  title: string;
  topic: string;
  topicSlug: string;
}

const TOPIC_SLUG = "subject/high-school/10/mathematics/metadata-topic";
const SECTION_SLUG = `${TOPIC_SLUG}/metadata-section`;
const BASE_TOPIC: SyncedSubjectTopic = {
  category: "high-school",
  description: "Old topic description",
  grade: "10",
  locale: "id",
  material: "mathematics",
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
            description: "New topic description",
            sectionCount: 2,
            title: "New Topic Title",
          }),
        ],
      }
    );
    const topic = await t.query(
      async (ctx) =>
        await ctx.db
          .query("subjectTopics")
          .withIndex("by_locale_and_slug", (q) =>
            q.eq("locale", "id").eq("slug", TOPIC_SLUG)
          )
          .unique()
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(updated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(topic).toMatchObject({
      description: "New topic description",
      sectionCount: 2,
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
          q.eq("content_id", `id/${SECTION_SLUG}`)
        )
        .unique();
      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
          q
            .eq("contentRef.type", "subject")
            .eq("slug", SECTION_SLUG)
            .eq("locale", "id")
        )
        .unique();

      return { audioSource, authorLinks, search, section };
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
      title: "New Subject Title",
    });
    expect(snapshot.section.subject).toBeUndefined();
    expect(snapshot.authorLinks).toHaveLength(1);
    expect(snapshot.search).toMatchObject({
      contentHash: "same-subject-hash",
      route: SECTION_SLUG,
      title: "New Subject Title",
    });
    expect(snapshot.audioSource).toMatchObject({
      contentHash: "same-subject-hash",
      slug: SECTION_SLUG,
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

      const missingId = await ctx.db.insert("subjectSections", {
        body: "Missing body",
        category: "high-school",
        contentHash: "missing-hash",
        date: 1,
        grade: "10",
        locale: "id",
        material: "mathematics",
        section: "missing",
        slug: "subject/high-school/10/mathematics/metadata-topic/missing",
        syncedAt: 1,
        title: "Missing",
        topic: "metadata-topic",
        topicId: topic._id,
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
          q.eq("content_id", `id/${SECTION_SLUG}`)
        )
        .unique();
      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
          q
            .eq("contentRef.type", "subject")
            .eq("slug", SECTION_SLUG)
            .eq("locale", "id")
        )
        .unique();

      return { audioSource, authorLinks, search, section };
    });

    expect(result).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      audioSource: null,
      authorLinks: [],
      search: null,
      section: null,
    });
  });

  it("deletes stale subject topics with their sections and rejects unsafe section counts", async () => {
    const t = convexTest(schema, convexModules);

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
        sectionCount: 0,
        slug: `${TOPIC_SLUG}-missing`,
        syncedAt: 1,
        title: "Missing",
        topic: "missing",
      });

      if (!(topic && unsafeTopic)) {
        throw new Error("Expected synced subject topics before stale delete.");
      }

      await ctx.db.patch("subjectTopics", unsafeTopic._id, { sectionCount: 0 });
      await ctx.db.insert("subjectSections", {
        body: "Unsafe body",
        category: "high-school",
        contentHash: "unsafe-hash",
        date: 1,
        grade: "10",
        locale: "id",
        material: "mathematics",
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

      return { section, topic };
    });

    expect(result).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({ section: null, topic: null });
  });
});
