import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { mergePopularAudioContentItems } from "@repo/backend/convex/contents/helpers/popularity";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

async function insertSubjectSection(ctx: MutationCtx, locale: "en" | "id") {
  const slug =
    "subject/high-school/10/mathematics/vector-operations/vector-addition";
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    material: "mathematics",
    order: 0,
    topic: "vector-operations",
    title: "Vector and Operations",
    locale,
    slug: "subject/high-school/10/mathematics/vector-operations",
    sectionCount: 1,
    syncedAt: 1,
  });

  return await ctx.db.insert("subjectSections", {
    topicId,
    locale,
    slug,
    category: "high-school",
    grade: "10",
    material: "mathematics",
    order: 0,
    topic: "vector-operations",
    section: "vector-addition",
    title: "Vector Addition",
    description: "Vector addition",
    date: 1,
    subject: "Vector and Operations",
    body: "Body",
    contentHash: `subject-${locale}-hash`,
    syncedAt: 1,
  });
}

async function insertArticle(ctx: MutationCtx, slug: string) {
  return await ctx.db.insert("articleContents", {
    locale: "en",
    slug,
    category: "politics",
    articleSlug: slug.split("/").at(-1) ?? slug,
    title: "Article",
    description: "Article",
    date: 1,
    body: "Body",
    contentHash: `${slug}-hash`,
    syncedAt: 1,
  });
}

describe("contents/helpers/popularity", () => {
  it("keeps the highest-view source row for one slug and filters low-volume items", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(async (ctx) => ({
      articleId: await insertArticle(
        ctx,
        "articles/politics/dynastic-politics-asian-values"
      ),
      englishSubjectId: await insertSubjectSection(ctx, "en"),
      indonesianSubjectId: await insertSubjectSection(ctx, "id"),
    }));

    const items = mergePopularAudioContentItems([
      {
        ref: { type: "subject", id: ids.englishSubjectId },
        sourceContent: {
          contentHash: "hash-en-low",
          locale: "en",
          ref: { type: "subject", id: ids.englishSubjectId },
          slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
        },
        viewCount: 20,
      },
      {
        ref: { type: "subject", id: ids.indonesianSubjectId },
        sourceContent: {
          contentHash: "hash-id-high",
          locale: "id",
          ref: { type: "subject", id: ids.indonesianSubjectId },
          slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
        },
        viewCount: 35,
      },
      {
        ref: { type: "article", id: ids.articleId },
        sourceContent: {
          contentHash: "hash-article",
          locale: "en",
          ref: { type: "article", id: ids.articleId },
          slug: "articles/politics/dynastic-politics-asian-values",
        },
        viewCount: 9,
      },
    ]);

    expect(items).toEqual([
      {
        ref: { type: "subject", id: ids.indonesianSubjectId },
        sourceContent: {
          contentHash: "hash-id-high",
          locale: "id",
          ref: { type: "subject", id: ids.indonesianSubjectId },
          slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
        },
        viewCount: 35,
      },
    ]);
  });

  it("falls back to ref identity when source lookup metadata is missing", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(async (ctx) => ({
      firstArticleId: await insertArticle(ctx, "articles/politics/first"),
      secondArticleId: await insertArticle(ctx, "articles/politics/second"),
    }));

    const items = mergePopularAudioContentItems([
      {
        ref: { type: "article", id: ids.secondArticleId },
        viewCount: 15,
      },
      {
        ref: { type: "article", id: ids.firstArticleId },
        viewCount: 30,
      },
    ]);

    expect(items).toEqual([
      {
        ref: { type: "article", id: ids.firstArticleId },
        viewCount: 30,
      },
      {
        ref: { type: "article", id: ids.secondArticleId },
        viewCount: 15,
      },
    ]);
  });
});
