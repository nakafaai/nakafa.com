import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncAudioContentSource } from "@repo/backend/convex/audioStudies/helpers/sources";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const publishedAt = 1_744_416_000_000;
const subjectTopicSlug = "subject/high-school/10/mathematics/vector-operations";
const subjectSectionSlug =
  "subject/high-school/10/mathematics/vector-operations/vector-addition";
const articleSlug = "articles/politics/dynastic-politics-asian-values";

const englishSubject = {
  body: "Vector addition differs from scalar addition.",
  contentHash: "subject-en-hash",
  description: "Master vector addition.",
  locale: "en",
  section: "vector-addition",
  subject: "Vector and Operations",
  title: "Vector Addition",
  topicTitle: "Vector and Operations",
} as const;

const indonesianSubject = {
  body: "Penjumlahan vektor berbeda dengan penjumlahan skalar.",
  contentHash: "subject-id-hash",
  description: "Kuasai penjumlahan vektor.",
  locale: "id",
  section: englishSubject.section,
  subject: "Vektor dan Operasinya",
  title: "Penjumlahan Vektor",
  topicTitle: "Vektor dan Operasinya",
} as const;

const englishArticle = {
  body: "The legitimacy of dynastic politics is increasing.",
  contentHash: "article-en-hash",
  description: "Power is passed down under the guise of values.",
  locale: "en",
  title: "Framing Dynastic Politics in Local Elections",
} as const;

const indonesianArticle = {
  body: "Legitimasi politik dinasti semakin meningkat.",
  contentHash: "article-id-hash",
  description: "Kekuasaan diwariskan dengan dalih nilai.",
  locale: "id",
  title: "Membingkai Politik Dinasti dalam Pemilihan Lokal",
} as const;

/** Inserts one subject section and its compact audio source row. */
async function insertSubject(
  ctx: MutationCtx,
  source: typeof englishSubject | typeof indonesianSubject,
  syncSource = true
) {
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    locale: source.locale,
    material: "mathematics",
    sectionCount: 15,
    slug: subjectTopicSlug,
    syncedAt: 1,
    title: source.topicTitle,
    topic: "vector-operations",
  });
  const sectionId = await ctx.db.insert("subjectSections", {
    body: source.body,
    category: "high-school",
    contentHash: source.contentHash,
    date: publishedAt,
    description: source.description,
    grade: "10",
    locale: source.locale,
    material: "mathematics",
    section: source.section,
    slug: subjectSectionSlug,
    subject: source.subject,
    syncedAt: 1,
    title: source.title,
    topic: "vector-operations",
    topicId,
  });

  if (syncSource) {
    await syncAudioContentSource(ctx, {
      contentHash: source.contentHash,
      locale: source.locale,
      ref: { type: "subject", id: sectionId },
      slug: subjectSectionSlug,
      syncedAt: 1,
    });
  }

  return sectionId;
}

/** Inserts both locales for the subject audio queue scenarios. */
async function insertSubjectPair(ctx: MutationCtx) {
  return {
    englishId: await insertSubject(ctx, englishSubject),
    indonesianId: await insertSubject(ctx, indonesianSubject),
  };
}

/** Inserts one article and its compact audio source row. */
async function insertArticle(
  ctx: MutationCtx,
  source: typeof englishArticle | typeof indonesianArticle
) {
  const articleId = await ctx.db.insert("articleContents", {
    articleSlug: "dynastic-politics-asian-values",
    body: source.body,
    category: "politics",
    contentHash: source.contentHash,
    date: publishedAt,
    description: source.description,
    locale: source.locale,
    slug: articleSlug,
    syncedAt: 1,
    title: source.title,
  });

  await syncAudioContentSource(ctx, {
    contentHash: source.contentHash,
    locale: source.locale,
    ref: { type: "article", id: articleId },
    slug: articleSlug,
    syncedAt: 1,
  });

  return articleId;
}

/** Inserts both locales for the article audio queue scenarios. */
async function insertArticlePair(ctx: MutationCtx) {
  return {
    englishId: await insertArticle(ctx, englishArticle),
    indonesianId: await insertArticle(ctx, indonesianArticle),
  };
}

/** Inserts a subject queue item in the English locale. */
async function insertSubjectQueueItem(
  ctx: MutationCtx,
  contentId: Id<"subjectSections">,
  status: "pending" | "completed"
) {
  const queueItem = {
    contentRef: { type: "subject" as const, id: contentId },
    locale: "en" as const,
    maxRetries: 3,
    priorityScore: 100,
    requestedAt: 1,
    retryCount: 0,
    slug: subjectSectionSlug,
    status,
    updatedAt: 1,
  };

  if (status === "completed") {
    return await ctx.db.insert("audioGenerationQueue", {
      ...queueItem,
      completedAt: 1,
    });
  }

  return await ctx.db.insert("audioGenerationQueue", queueItem);
}

/** Inserts a completed Indonesian audio row for the current subject hash. */
async function insertCompletedIndonesianAudio(
  ctx: MutationCtx,
  contentId: Id<"subjectSections">
) {
  await ctx.db.insert("contentAudios", {
    contentHash: indonesianSubject.contentHash,
    contentRef: { type: "subject", id: contentId },
    generationAttempts: 1,
    locale: indonesianSubject.locale,
    model: "eleven_v3",
    status: "completed",
    updatedAt: 1,
    voiceId: "voice-1",
  });
}

describe("contents/mutations/audio", () => {
  beforeEach(() => {
    vi.spyOn(logger, "debug").mockImplementation(() => undefined);
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when there are no popularity items", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      { items: [] }
    );

    expect(result).toEqual({ processed: 0, queued: 0 });
  });

  it("skips items below the minimum view threshold", async () => {
    const t = convexTest(schema, convexModules);
    const sourceId = await t.mutation(
      async (ctx) => await insertSubject(ctx, englishSubject)
    );

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: sourceId }, viewCount: 9 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toEqual({ processed: 1, queued: 0 });
    expect(queuedItems).toHaveLength(0);
  });

  it("queues one item per supported locale for a subject candidate", async () => {
    const t = convexTest(schema, convexModules);
    const { englishId } = await t.mutation(insertSubjectPair);

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: englishId }, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", subjectSectionSlug).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("uses provided source lookup metadata when queueing a subject candidate", async () => {
    const t = convexTest(schema, convexModules);
    const { englishId } = await t.mutation(insertSubjectPair);

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [
          {
            ref: { type: "subject", id: englishId },
            sourceContent: {
              contentHash: englishSubject.contentHash,
              locale: englishSubject.locale,
              ref: { type: "subject", id: englishId },
              slug: subjectSectionSlug,
            },
            viewCount: 25,
          },
        ],
      }
    );
    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", subjectSectionSlug).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
  });

  it("skips content without compact audio source metadata", async () => {
    const t = convexTest(schema, convexModules);
    const sourceId = await t.mutation(
      async (ctx) => await insertSubject(ctx, englishSubject, false)
    );

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: sourceId }, viewCount: 25 }],
      }
    );

    expect(result).toEqual({ processed: 1, queued: 0 });
  });

  it("queues only locales that exist for the content slug", async () => {
    const t = convexTest(schema, convexModules);
    const sourceId = await t.mutation(
      async (ctx) => await insertSubject(ctx, englishSubject)
    );

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: sourceId }, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]?.locale).toBe("en");
  });

  it("does not duplicate locale queue items that are already pending", async () => {
    const t = convexTest(schema, convexModules);
    const { englishId } = await t.mutation(async (ctx) => {
      const subjectIds = await insertSubjectPair(ctx);
      await insertSubjectQueueItem(ctx, subjectIds.englishId, "pending");
      return subjectIds;
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: englishId }, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", subjectSectionSlug).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("sorts popularity items before applying the threshold cutoff", async () => {
    const t = convexTest(schema, convexModules);
    const { articleId, subjectId } = await t.mutation(async (ctx) => ({
      articleId: (await insertArticlePair(ctx)).englishId,
      subjectId: await insertSubject(ctx, englishSubject),
    }));

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [
          { ref: { type: "subject", id: subjectId }, viewCount: 9 },
          { ref: { type: "article", id: articleId }, viewCount: 25 },
        ],
      }
    );
    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", articleSlug).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 2, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("replaces completed queue items before re-enqueuing", async () => {
    const t = convexTest(schema, convexModules);
    const { completedQueueId, englishId } = await t.mutation(async (ctx) => {
      const subjectIds = await insertSubjectPair(ctx);
      return {
        completedQueueId: await insertSubjectQueueItem(
          ctx,
          subjectIds.englishId,
          "completed"
        ),
        englishId: subjectIds.englishId,
      };
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: englishId }, viewCount: 25 }],
      }
    );
    const { completedQueueItem, queuedItems } = await t.query(async (ctx) => ({
      completedQueueItem: await ctx.db.get(
        "audioGenerationQueue",
        completedQueueId
      ),
      queuedItems: await ctx.db
        .query("audioGenerationQueue")
        .withIndex("by_slug_and_status", (q) =>
          q.eq("slug", subjectSectionSlug).eq("status", "pending")
        )
        .collect(),
    }));

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(completedQueueItem).toBeNull();
    expect(queuedItems).toHaveLength(2);
  });

  it("skips locales that already have completed audio for the current hash", async () => {
    const t = convexTest(schema, convexModules);
    const { englishId } = await t.mutation(async (ctx) => {
      const subjectIds = await insertSubjectPair(ctx);
      await insertCompletedIndonesianAudio(ctx, subjectIds.indonesianId);
      return subjectIds;
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: englishId }, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]?.contentRef).toEqual({
      type: "subject",
      id: englishId,
    });
    expect(queuedItems[0]?.locale).toBe(englishSubject.locale);
    expect(queuedItems[0]?.slug).toBe(subjectSectionSlug);
  });

  it("queues one item per supported locale for an article candidate", async () => {
    const t = convexTest(schema, convexModules);
    const { englishId } = await t.mutation(insertArticlePair);

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "article", id: englishId }, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", articleSlug).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });
});
