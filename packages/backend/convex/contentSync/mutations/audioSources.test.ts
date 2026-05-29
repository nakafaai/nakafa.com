import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const ARTICLE_SLUG = "articles/science/audio-source";
const SUBJECT_TOPIC_SLUG =
  "subject/high-school/10/mathematics/audio-source-topic";
const SUBJECT_SECTION_SLUG =
  "subject/high-school/10/mathematics/audio-source-topic/audio-source-section";

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
          references: [],
          slug: ARTICLE_SLUG,
          title: "Article Source",
        },
      ],
    });

    const sourceBefore = await t.query(async (ctx) => {
      const source = await ctx.db
        .query("audioContentSources")
        .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
          q
            .eq("contentRef.type", "article")
            .eq("slug", ARTICLE_SLUG)
            .eq("locale", "id")
        )
        .unique();

      if (!source || source.contentRef.type !== "article") {
        throw new Error("Expected synced article audio source.");
      }

      return {
        articleId: source.contentRef.id,
        source,
      };
    });

    expect(sourceBefore.source).toMatchObject({
      contentHash: "article-source-hash",
      contentRef: { type: "article" },
      locale: "id",
      slug: ARTICLE_SLUG,
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
          .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
            q
              .eq("contentRef.type", "article")
              .eq("slug", ARTICLE_SLUG)
              .eq("locale", "id")
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
            grade: "10",
            locale: "en",
            material: "mathematics",
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
        .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
          q
            .eq("contentRef.type", "subject")
            .eq("slug", SUBJECT_SECTION_SLUG)
            .eq("locale", "en")
        )
        .unique();

      if (!source || source.contentRef.type !== "subject") {
        throw new Error("Expected synced subject audio source.");
      }

      return {
        sectionId: source.contentRef.id,
        source,
      };
    });

    expect(sourceBefore.source).toMatchObject({
      contentHash: "subject-source-hash",
      contentRef: { type: "subject" },
      locale: "en",
      slug: SUBJECT_SECTION_SLUG,
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
          .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
            q
              .eq("contentRef.type", "subject")
              .eq("slug", SUBJECT_SECTION_SLUG)
              .eq("locale", "en")
          )
          .unique()
    );

    expect(sourceAfter).toBeNull();
  });
});
