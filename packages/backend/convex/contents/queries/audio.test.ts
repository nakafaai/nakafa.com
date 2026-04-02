import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const REAL_VECTOR_PUBLISHED_AT = 1_744_416_000_000;
const REAL_VECTOR_TOPIC_SLUG =
  "subject/high-school/10/mathematics/vector-operations";
const REAL_VECTOR_SECTION_SLUG =
  "subject/high-school/10/mathematics/vector-operations/vector-addition";
const REAL_VECTOR_TOPIC_SECTION_COUNT = 15;
const REAL_DYNASTIC_ARTICLE_PUBLISHED_AT = 1_723_075_200_000;
const REAL_DYNASTIC_ARTICLE_SLUG =
  "articles/politics/dynastic-politics-asian-values";
const REAL_DYNASTIC_ARTICLE_ID = "dynastic-politics-asian-values";

describe("contents/queries/audio", () => {
  it("returns one ranked item per slug with source lookup metadata", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const articleId = await ctx.db.insert("articleContents", {
        locale: "en",
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
        description:
          "Power is passed down under the guise of practicing asian values.",
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: "Article body",
        contentHash: "article-en-hash",
        syncedAt: 1,
      });

      const englishSubjectId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: "vector-operations",
          title: "Vector and Operations",
          locale: "en",
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: "en",
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: "vector-operations",
        section: "vector-addition",
        title: "Vector Addition",
        description: "English vector addition",
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: "Vector and Operations",
        body: "English subject body",
        contentHash: "subject-en-hash",
        syncedAt: 1,
      });

      const indonesianSubjectId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: "vector-operations",
          title: "Vektor dan Operasinya",
          locale: "id",
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: "id",
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: "vector-operations",
        section: "vector-addition",
        title: "Penjumlahan Vektor",
        description: "Indonesian vector addition",
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: "Vektor dan Operasinya",
        body: "Indonesian subject body",
        contentHash: "subject-id-hash",
        syncedAt: 1,
      });

      await ctx.db.insert("articlePopularity", {
        contentId: articleId,
        updatedAt: 1,
        viewCount: 80,
      });
      await ctx.db.insert("subjectPopularity", {
        contentId: englishSubjectId,
        updatedAt: 1,
        viewCount: 40,
      });
      await ctx.db.insert("subjectPopularity", {
        contentId: indonesianSubjectId,
        updatedAt: 1,
        viewCount: 25,
      });
    });

    const result = await t.query(
      internal.contents.queries.audio.getPopularContentForAudioQueue,
      {}
    );

    expect(result).toEqual([
      {
        ref: expect.objectContaining({ type: "article" }),
        sourceContent: {
          contentHash: "article-en-hash",
          locale: "en",
          ref: expect.objectContaining({ type: "article" }),
          slug: REAL_DYNASTIC_ARTICLE_SLUG,
        },
        viewCount: 80,
      },
      {
        ref: expect.objectContaining({ type: "subject" }),
        sourceContent: {
          contentHash: "subject-en-hash",
          locale: "en",
          ref: expect.objectContaining({ type: "subject" }),
          slug: REAL_VECTOR_SECTION_SLUG,
        },
        viewCount: 40,
      },
    ]);
  });

  it("skips popularity rows whose source content no longer exists", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const articleId = await ctx.db.insert("articleContents", {
        locale: "en",
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
        description:
          "Power is passed down under the guise of practicing asian values.",
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: "Article body",
        contentHash: "article-en-hash",
        syncedAt: 1,
      });

      await ctx.db.insert("articlePopularity", {
        contentId: articleId,
        updatedAt: 1,
        viewCount: 80,
      });
      const subjectId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: "vector-operations",
          title: "Vector and Operations",
          locale: "en",
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: "en",
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: "vector-operations",
        section: "vector-addition",
        title: "Vector Addition",
        description: "English vector addition",
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: "Vector and Operations",
        body: "English subject body",
        contentHash: "subject-en-hash",
        syncedAt: 1,
      });

      await ctx.db.insert("subjectPopularity", {
        contentId: subjectId,
        updatedAt: 1,
        viewCount: 40,
      });
      await ctx.db.delete("articleContents", articleId);
      await ctx.db.delete("subjectSections", subjectId);
    });

    const result = await t.query(
      internal.contents.queries.audio.getPopularContentForAudioQueue,
      {}
    );

    expect(result).toEqual([]);
  });
});
