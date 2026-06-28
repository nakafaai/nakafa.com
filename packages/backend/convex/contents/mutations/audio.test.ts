import { internal } from "@repo/backend/convex/_generated/api";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { syncAudioContentSource } from "@repo/backend/convex/audioStudies/helpers/sources";
import type { AudioContentLookup } from "@repo/backend/convex/contents/validators";
import schema from "@repo/backend/convex/schema";
import {
  getTestAudioContent,
  getTestAudioIdentity,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const publishedAt = 1_744_416_000_000;
const curriculumTopicSlug = "material/lesson/mathematics/vector-operations";
const curriculumLessonSlug =
  "material/lesson/mathematics/vector-operations/vector-addition";
const articleSlug = "articles/politics/dynastic-politics-asian-values";

const englishSubject = {
  body: "Vector addition differs from scalar addition.",
  contentHash: "subject-en-hash",
  description: "Master vector addition.",
  locale: "en" as const,
  section: "vector-addition",
  subject: "Vector and Operations",
  title: "Vector Addition",
  topicTitle: "Vector and Operations",
};

const indonesianSubject = {
  body: "Penjumlahan vektor berbeda dengan penjumlahan skalar.",
  contentHash: "subject-id-hash",
  description: "Kuasai penjumlahan vektor.",
  locale: "id" as const,
  section: englishSubject.section,
  subject: "Vektor dan Operasinya",
  title: "Penjumlahan Vektor",
  topicTitle: "Vektor dan Operasinya",
};

const englishArticle = {
  body: "The legitimacy of dynastic politics is increasing.",
  contentHash: "article-en-hash",
  description: "Power is passed down under the guise of values.",
  locale: "en" as const,
  title: "Framing Dynastic Politics in Local Elections",
};

const indonesianArticle = {
  body: "Legitimasi politik dinasti semakin meningkat.",
  contentHash: "article-id-hash",
  description: "Kekuasaan diwariskan dengan dalih nilai.",
  locale: "id" as const,
  title: "Membingkai Politik Dinasti dalam Pemilihan Lokal",
};

const englishSubjectSource = getTestAudioContent({
  contentHash: englishSubject.contentHash,
  locale: englishSubject.locale,
  route: curriculumLessonSlug,
});
const indonesianSubjectSource = getTestAudioContent({
  contentHash: indonesianSubject.contentHash,
  locale: indonesianSubject.locale,
  route: curriculumLessonSlug,
});
const englishArticleSource = getTestAudioContent({
  contentHash: englishArticle.contentHash,
  locale: englishArticle.locale,
  route: articleSlug,
});
const indonesianArticleSource = getTestAudioContent({
  contentHash: indonesianArticle.contentHash,
  locale: indonesianArticle.locale,
  route: articleSlug,
});

function getAudioIdentityFields(sourceContent: AudioContentLookup) {
  return getTestAudioIdentity({
    locale: sourceContent.locale,
    route: sourceContent.route,
  });
}

function getSubjectSource(
  source: typeof englishSubject | typeof indonesianSubject
) {
  return source.locale === englishSubject.locale
    ? englishSubjectSource
    : indonesianSubjectSource;
}

function getArticleSource(
  source: typeof englishArticle | typeof indonesianArticle
) {
  return source.locale === englishArticle.locale
    ? englishArticleSource
    : indonesianArticleSource;
}

/** Inserts one curriculum lesson and optionally its compact graph audio source. */
async function insertSubject(
  ctx: MutationCtx,
  source: typeof englishSubject | typeof indonesianSubject,
  syncSource = true
) {
  const sourceContent = getSubjectSource(source);
  const topicId = await ctx.db.insert("curriculumTopics", {
    locale: source.locale,
    material: "mathematics",
    order: 0,
    sectionCount: 15,
    slug: curriculumTopicSlug,
    syncedAt: 1,
    title: source.topicTitle,
    topic: "vector-operations",
  });

  await ctx.db.insert("curriculumLessons", {
    body: source.body,
    contentHash: source.contentHash,
    date: publishedAt,
    description: source.description,
    locale: source.locale,
    material: "mathematics",
    order: 0,
    section: source.section,
    slug: curriculumLessonSlug,
    subject: source.subject,
    syncedAt: 1,
    title: source.title,
    topic: "vector-operations",
    topicId,
  });

  if (syncSource) {
    await syncAudioContentSource(ctx, {
      ...sourceContent,
      syncedAt: 1,
    });
  }

  return sourceContent;
}

async function insertSubjectPair(ctx: MutationCtx) {
  return {
    english: await insertSubject(ctx, englishSubject),
    indonesian: await insertSubject(ctx, indonesianSubject),
  };
}

/** Inserts one article and its compact graph audio source. */
async function insertArticle(
  ctx: MutationCtx,
  source: typeof englishArticle | typeof indonesianArticle
) {
  const sourceContent = getArticleSource(source);

  await ctx.db.insert("articleContents", {
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
    ...sourceContent,
    syncedAt: 1,
  });

  return sourceContent;
}

async function insertArticlePair(ctx: MutationCtx) {
  return {
    english: await insertArticle(ctx, englishArticle),
    indonesian: await insertArticle(ctx, indonesianArticle),
  };
}

/** Inserts a subject queue item in the source locale. */
async function insertSubjectQueueItem(
  ctx: MutationCtx,
  sourceContent: AudioContentLookup,
  status: "pending" | "completed"
) {
  const queueItem = {
    ...getAudioIdentityFields(sourceContent),
    maxRetries: 3,
    priorityScore: 100,
    requestedAt: 1,
    retryCount: 0,
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

async function insertCompletedAudio(
  ctx: MutationCtx,
  sourceContent: AudioContentLookup
) {
  await ctx.db.insert("contentAudios", {
    ...getAudioIdentityFields(sourceContent),
    contentHash: sourceContent.contentHash,
    generationAttempts: 1,
    model: "eleven_v3",
    status: "completed",
    updatedAt: 1,
    voiceId: "voice-1",
  });
}

async function readPendingQueueItems(ctx: Pick<QueryCtx, "db">, route: string) {
  return await ctx.db
    .query("audioGenerationQueue")
    .withIndex("by_route_and_status", (q) =>
      q.eq("route", route).eq("status", "pending")
    )
    .collect();
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

    await t.mutation(async (ctx) => await insertSubject(ctx, englishSubject));

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishSubjectSource, viewCount: 9 }],
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

    await t.mutation(insertSubjectPair);

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishSubjectSource, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await readPendingQueueItems(ctx, curriculumLessonSlug)
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("uses provided graph metadata for the source locale", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(
      async (ctx) => await insertSubject(ctx, englishSubject, false)
    );

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishSubjectSource, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await readPendingQueueItems(ctx, curriculumLessonSlug)
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]?.content_id).toBe(englishSubjectSource.content_id);
  });

  it("queues only locales that have source projections", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => await insertSubject(ctx, englishSubject));

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishSubjectSource, viewCount: 25 }],
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

    await t.mutation(async (ctx) => {
      const subjectSources = await insertSubjectPair(ctx);
      await insertSubjectQueueItem(ctx, subjectSources.english, "pending");
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishSubjectSource, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await readPendingQueueItems(ctx, curriculumLessonSlug)
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("sorts popularity items before applying the threshold cutoff", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertArticlePair(ctx);
      await insertSubject(ctx, englishSubject);
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [
          { sourceContent: englishSubjectSource, viewCount: 9 },
          { sourceContent: englishArticleSource, viewCount: 25 },
        ],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await readPendingQueueItems(ctx, articleSlug)
    );

    expect(result).toEqual({ processed: 2, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("replaces completed queue items before re-enqueuing", async () => {
    const t = convexTest(schema, convexModules);

    const completedQueueId = await t.mutation(async (ctx) => {
      const subjectSources = await insertSubjectPair(ctx);

      return await insertSubjectQueueItem(
        ctx,
        subjectSources.english,
        "completed"
      );
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishSubjectSource, viewCount: 25 }],
      }
    );
    const { completedQueueItem, queuedItems } = await t.query(async (ctx) => ({
      completedQueueItem: await ctx.db.get(
        "audioGenerationQueue",
        completedQueueId
      ),
      queuedItems: await readPendingQueueItems(ctx, curriculumLessonSlug),
    }));

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(completedQueueItem).toBeNull();
    expect(queuedItems).toHaveLength(2);
  });

  it("skips locales that already have completed audio for the current hash", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const subjectSources = await insertSubjectPair(ctx);
      await insertCompletedAudio(ctx, subjectSources.indonesian);
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishSubjectSource, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]?.content_id).toBe(englishSubjectSource.content_id);
    expect(queuedItems[0]?.locale).toBe(englishSubject.locale);
    expect(queuedItems[0]?.route).toBe(curriculumLessonSlug);
  });

  it("queues one item per supported locale for an article candidate", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(insertArticlePair);

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ sourceContent: englishArticleSource, viewCount: 25 }],
      }
    );
    const queuedItems = await t.query(
      async (ctx) => await readPendingQueueItems(ctx, articleSlug)
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });
});
