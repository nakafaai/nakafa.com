import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { getTestAudioContent } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const ARTICLE_SLUG = "articles/science/audio-source";
const SUBJECT_TOPIC_SLUG =
  "subject/high-school/10/mathematics/audio-source-topic";
const SUBJECT_SECTION_SLUG =
  "subject/high-school/10/mathematics/audio-source-topic/audio-source-section";
const articleSource = getTestAudioContent({
  contentHash: "article-source-hash",
  locale: "id",
  route: ARTICLE_SLUG,
});
const subjectSource = getTestAudioContent({
  contentHash: "subject-source-hash",
  locale: "en",
  route: SUBJECT_SECTION_SLUG,
});

describe("contentSync audio sources", () => {
  it("maintains compact article audio metadata through sync and stale delete", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(internal.contentSync.mutations.articles.bulkSyncArticles, {
      articles: [
        {
          articleSlug: "audio-source",
          authors: [],
          body: "large body not needed by the audio queue",
          category: "politics",
          contentHash: "article-source-hash",
          date: 1,
          description: "Article source",
          locale: "id",
          official: false,
          references: [],
          slug: ARTICLE_SLUG,
          title: "Article Source",
        },
      ],
    });

    const sourceBefore = await t.query(async (ctx) => {
      const source = await ctx.db
        .query("audioContentSources")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", articleSource.content_id)
        )
        .unique();
      const article = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", ARTICLE_SLUG)
        )
        .unique();

      if (!(source && article)) {
        throw new Error("Expected synced article audio source.");
      }

      return {
        articleId: article._id,
        source,
      };
    });

    expect(sourceBefore.source).toMatchObject({
      contentHash: articleSource.contentHash,
      content_id: articleSource.content_id,
      contentType: articleSource.contentType,
      locale: "id",
      route: ARTICLE_SLUG,
    });

    await t.mutation(
      internal.contentSync.mutations.articles.deleteStaleArticles,
      {
        articleIds: [sourceBefore.articleId],
      }
    );

    const sourceAfter = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioContentSources")
          .withIndex("by_content_id", (q) =>
            q.eq("content_id", articleSource.content_id)
          )
          .unique()
    );

    expect(sourceAfter).toBeNull();
  });

  it("maintains compact subject audio metadata through sync and stale delete", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectTopics,
      {
        topics: [
          {
            category: "high-school",
            contentHash: "subject-topic-source-hash",
            grade: "10",
            locale: "en",
            material: "mathematics",
            order: 0,
            sectionCount: 1,
            slug: SUBJECT_TOPIC_SLUG,
            title: "Audio Source Topic",
            topic: "audio-source-topic",
          },
        ],
      }
    );
    await t.mutation(
      internal.contentSync.mutations.subjects.bulkSyncSubjectSections,
      {
        sections: [
          {
            authors: [],
            body: "large section body not needed by the audio queue",
            category: "high-school",
            contentHash: "subject-source-hash",
            date: 1,
            description: "Subject source",
            grade: "10",
            locale: "en",
            material: "mathematics",
            order: 0,
            section: "audio-source-section",
            slug: SUBJECT_SECTION_SLUG,
            subject: "Mathematics",
            title: "Audio Source Section",
            topic: "audio-source-topic",
            topicSlug: SUBJECT_TOPIC_SLUG,
          },
        ],
      }
    );

    const sourceBefore = await t.query(async (ctx) => {
      const source = await ctx.db
        .query("audioContentSources")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", subjectSource.content_id)
        )
        .unique();
      const section = await ctx.db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "en").eq("slug", SUBJECT_SECTION_SLUG)
        )
        .unique();

      if (!(source && section)) {
        throw new Error("Expected synced subject audio source.");
      }

      return {
        sectionId: section._id,
        source,
      };
    });

    expect(sourceBefore.source).toMatchObject({
      contentHash: subjectSource.contentHash,
      content_id: subjectSource.content_id,
      contentType: subjectSource.contentType,
      locale: "en",
      route: SUBJECT_SECTION_SLUG,
    });

    await t.mutation(
      internal.contentSync.mutations.subjects.deleteStaleSubjectSections,
      {
        sectionIds: [sourceBefore.sectionId],
      }
    );

    const sourceAfter = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioContentSources")
          .withIndex("by_content_id", (q) =>
            q.eq("content_id", subjectSource.content_id)
          )
          .unique()
    );

    expect(sourceAfter).toBeNull();
  });
});
