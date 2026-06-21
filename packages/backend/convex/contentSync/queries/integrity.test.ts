import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  audioModelElevenV3,
  audioStatusPending,
} from "@repo/backend/convex/lib/validators/audio";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/integrity-article";
const GRAPH_ANALYTICS_INTEGRITY_TARGETS = [
  "contentViews",
  "contentViewAnalyticsQueue",
  "learningPopularity",
  "learningTrendingBuckets",
] as const;
const GRAPH_AUDIO_INTEGRITY_TARGETS = [
  "audioContentSources",
  "audioGenerationQueue",
  "contentAudios",
] as const;
const GRAPH_INTEGRITY_TARGETS = [
  "contentRoutes",
  "contentSearch",
  "contentRoutePages",
  "parts",
  ...GRAPH_ANALYTICS_INTEGRITY_TARGETS,
  ...GRAPH_AUDIO_INTEGRITY_TARGETS,
] as const;

describe("contentSync/queries/integrity", () => {
  it("reports graph-shaped contentRoute content_id values that differ from assetId", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(`${articleGraph().assetId}:stale`);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", contentRoute(graph));
    });

    const result = await getGraphIntegrity(t, "contentRoutes");

    expect(result).toMatchObject({
      checkedRefs: 1,
      firstMismatchedContentId: {
        assetId: graph.assetId,
        content_id: graph.content_id,
        route: ARTICLE_ROUTE,
        section: "articles",
      },
      missingGraphRows: 0,
      mismatchedContentIds: 1,
      routeShapedContentIds: 0,
      scannedRows: 1,
    });
  });

  it("reports graph-shaped contentSearch content_id values that differ from assetId", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(`${articleGraph().assetId}:stale`);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", contentSearchDocument(graph));
    });

    const result = await getGraphIntegrity(t, "contentSearch");

    expect(result).toMatchObject({
      checkedRefs: 1,
      firstMismatchedContentId: {
        assetId: graph.assetId,
        content_id: graph.content_id,
        route: ARTICLE_ROUTE,
        section: "articles",
      },
      missingGraphRows: 0,
      mismatchedContentIds: 1,
      routeShapedContentIds: 0,
      scannedRows: 1,
    });
  });

  it("reports graph-shaped route artifact content_id values that differ from assetId", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(`${articleGraph().assetId}:stale`);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutePages", {
        locale: "id",
        page: 0,
        routeCount: 1,
        routes: [contentRoutePageItem(graph)],
        section: "articles",
        syncedAt: NOW,
      });
    });

    const result = await getGraphIntegrity(t, "contentRoutePages");

    expect(result).toMatchObject({
      checkedRefs: 1,
      firstMismatchedContentId: {
        assetId: graph.assetId,
        content_id: graph.content_id,
        route: ARTICLE_ROUTE,
        section: "articles",
      },
      missingGraphRows: 0,
      mismatchedContentIds: 1,
      routeShapedContentIds: 0,
      scannedRows: 1,
    });
  });

  it("reports graph-shaped Nakafa preview content_id values that differ from assetId", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(`${articleGraph().assetId}:stale`);

    await t.mutation(async (ctx) => {
      const messageId = await insertAssistantMessage(ctx);
      await ctx.db.insert("parts", {
        dataNakafaData: {
          input: { content_ref: graph.assetId },
          kind: "content",
          result: {
            ...contentSearchRef(graph),
            description: "Preview description",
            title: "Preview title",
          },
          status: "done",
        },
        dataNakafaId: "preview-1",
        messageId,
        order: 0,
        type: "data-nakafa",
      });
    });

    const result = await getGraphIntegrity(t, "parts");

    expect(result).toMatchObject({
      checkedRefInputs: 1,
      checkedRefs: 1,
      firstMismatchedContentId: {
        assetId: graph.assetId,
        content_id: graph.content_id,
        kind: "content",
        route: ARTICLE_ROUTE,
        section: "articles",
      },
      invalidRefInputs: 0,
      missingGraphRows: 0,
      mismatchedContentIds: 1,
      routeShapedContentIds: 0,
      scannedRows: 1,
    });
  });

  it("reports route-shaped Nakafa input refs across loading and done parts", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(articleGraph().assetId);

    await t.mutation(async (ctx) => {
      const messageId = await insertAssistantMessage(ctx);
      await ctx.db.insert("parts", {
        dataNakafaData: {
          input: { content_ref: `id/${ARTICLE_ROUTE}` },
          kind: "content",
          status: "loading",
        },
        dataNakafaId: "preview-loading",
        messageId,
        order: 0,
        type: "data-nakafa",
      });
      await ctx.db.insert("parts", {
        dataNakafaData: {
          input: {
            content_ref: `id/${ARTICLE_ROUTE}`,
            exercise_number: 1,
          },
          kind: "exercise",
          result: {
            ...contentSearchRef(graph),
            count: 1,
            exercise_number: 1,
            numbers: [1],
            title: "Preview exercise",
          },
          status: "done",
        },
        dataNakafaId: "preview-done",
        messageId,
        order: 1,
        type: "data-nakafa",
      });
    });

    const result = await getGraphIntegrity(t, "parts");

    expect(result).toMatchObject({
      checkedRefInputs: 2,
      checkedRefs: 1,
      firstInvalidRefInput: {
        content_ref: `id/${ARTICLE_ROUTE}`,
        kind: "content",
        status: "loading",
      },
      invalidRefInputs: 2,
      missingGraphRows: 0,
      mismatchedContentIds: 0,
      routeShapedContentIds: 0,
      scannedRows: 2,
    });
  });

  it("accepts durable analytics rows that store graph identity", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(articleGraph().assetId);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentViews", {
        ...graph,
        deviceId: "integrity-device",
        firstViewedAt: NOW,
        lastViewedAt: NOW,
        locale: "id",
        route: ARTICLE_ROUTE,
        section: "articles",
      });
      await ctx.db.insert("contentViewAnalyticsQueue", {
        ...graph,
        locale: "id",
        partition: 0,
        route: ARTICLE_ROUTE,
        section: "articles",
        viewedAt: NOW,
      });
      await ctx.db.insert("learningPopularity", {
        ...graph,
        locale: "id",
        section: "articles",
        updatedAt: NOW,
        viewCount: 1,
      });
      await ctx.db.insert("learningTrendingBuckets", {
        ...graph,
        bucketStart: NOW,
        locale: "id",
        section: "articles",
        updatedAt: NOW,
        viewCount: 1,
      });
    });

    for (const target of GRAPH_ANALYTICS_INTEGRITY_TARGETS) {
      await expectCleanGraphIdentityIntegrity(t, target);
    }
  });

  it("reports durable analytics rows whose graph content_id differs from assetId", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(`${articleGraph().assetId}:stale`);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentViews", {
        ...graph,
        deviceId: "integrity-device",
        firstViewedAt: NOW,
        lastViewedAt: NOW,
        locale: "id",
        route: ARTICLE_ROUTE,
        section: "articles",
      });
      await ctx.db.insert("contentViewAnalyticsQueue", {
        ...graph,
        locale: "id",
        partition: 0,
        route: ARTICLE_ROUTE,
        section: "articles",
        viewedAt: NOW,
      });
      await ctx.db.insert("learningPopularity", {
        ...graph,
        locale: "id",
        section: "articles",
        updatedAt: NOW,
        viewCount: 1,
      });
    });

    await expectMismatchedGraphIdentityIntegrity(t, "contentViews", {
      assetId: graph.assetId,
      content_id: graph.content_id,
      kind: "contentViews",
      route: ARTICLE_ROUTE,
      section: "articles",
    });
    await expectMismatchedGraphIdentityIntegrity(
      t,
      "contentViewAnalyticsQueue",
      {
        assetId: graph.assetId,
        content_id: graph.content_id,
        kind: "contentViewAnalyticsQueue",
        route: ARTICLE_ROUTE,
        section: "articles",
      }
    );
    await expectMismatchedGraphIdentityIntegrity(t, "learningPopularity", {
      assetId: graph.assetId,
      content_id: graph.content_id,
      kind: "learningPopularity",
      section: "articles",
    });
  });

  it("accepts audio rows that store graph identity", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(articleGraph().assetId);

    await t.mutation(async (ctx) => {
      await insertAudioRows(ctx, graph);
    });

    for (const target of GRAPH_AUDIO_INTEGRITY_TARGETS) {
      await expectCleanGraphIdentityIntegrity(t, target);
    }
  });

  it("reports audio rows whose graph content_id differs from assetId", async () => {
    const t = convexTest(schema, convexModules);
    const graph = articleGraphWithContentId(`${articleGraph().assetId}:stale`);

    await t.mutation(async (ctx) => {
      await insertAudioRows(ctx, graph);
    });

    for (const target of GRAPH_AUDIO_INTEGRITY_TARGETS) {
      await expectMismatchedGraphIdentityIntegrity(t, target, {
        assetId: graph.assetId,
        content_id: graph.content_id,
        kind: target,
        route: ARTICLE_ROUTE,
      });
    }
  });
});

type GraphIntegrityTarget = (typeof GRAPH_INTEGRITY_TARGETS)[number];

/** Runs the internal graph integrity verifier for one target. */
function getGraphIntegrity(
  t: ReturnType<typeof convexTest>,
  target: GraphIntegrityTarget
) {
  return t.query(
    internal.contentSync.queries.integrity.getGraphIdentityIntegrityPage,
    {
      paginationOpts: {
        cursor: null,
        numItems: 100,
      },
      target,
    }
  );
}

/** Asserts one graph-backed table has clean graph refs. */
async function expectCleanGraphIdentityIntegrity(
  t: ReturnType<typeof convexTest>,
  target: GraphIntegrityTarget
) {
  const result = await getGraphIntegrity(t, target);

  expect(result).toMatchObject({
    checkedRefs: 1,
    missingGraphRows: 0,
    mismatchedContentIds: 0,
    routeShapedContentIds: 0,
    scannedRows: 1,
  });
}

/** Asserts one graph-backed table reports mismatched graph identity. */
async function expectMismatchedGraphIdentityIntegrity(
  t: ReturnType<typeof convexTest>,
  target: GraphIntegrityTarget,
  issue: {
    readonly assetId: string;
    readonly content_id: string;
    readonly kind: string;
    readonly route?: string;
    readonly section?: Doc<"contentRoutes">["section"];
  }
) {
  const result = await getGraphIntegrity(t, target);

  expect(result).toMatchObject({
    checkedRefs: 1,
    firstMismatchedContentId: issue,
    missingGraphRows: 0,
    mismatchedContentIds: 1,
    routeShapedContentIds: 0,
    scannedRows: 1,
  });
}

/** Inserts one row in each graph-backed audio table. */
async function insertAudioRows(
  ctx: MutationCtx,
  graph: ReturnType<typeof articleGraphWithContentId>
) {
  const identity = audioIdentity(graph);

  await ctx.db.insert("audioContentSources", {
    ...identity,
    contentHash: "audio-source-hash",
    syncedAt: NOW,
  });
  await ctx.db.insert("audioGenerationQueue", {
    ...identity,
    maxRetries: 3,
    priorityScore: 10,
    requestedAt: NOW,
    retryCount: 0,
    status: "pending",
    updatedAt: NOW,
  });
  await ctx.db.insert("contentAudios", {
    ...identity,
    contentHash: "audio-content-hash",
    generationAttempts: 0,
    model: audioModelElevenV3,
    status: audioStatusPending,
    updatedAt: NOW,
    voiceId: "voice-integrity",
  });
}

/** Inserts the minimal chat/message ownership rows required for one persisted part. */
async function insertAssistantMessage(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-integrity-user",
    credits: 0,
    creditsResetAt: NOW,
    email: "integrity@example.com",
    name: "Integrity User",
    plan: "free",
  });
  const chatId = await ctx.db.insert("chats", {
    type: "study",
    updatedAt: NOW,
    userId,
    visibility: "private",
  });

  return await ctx.db.insert("messages", {
    chatId,
    identifier: "integrity-message",
    role: "assistant",
  });
}

/** Builds graph identity fields for the shared article route fixture. */
function articleGraph() {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: ARTICLE_ROUTE,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${ARTICLE_ROUTE}.`);
  }

  return identity;
}

/** Builds a full graph ref with a focused content_id override. */
function articleGraphWithContentId(contentId: string) {
  return {
    ...articleGraph(),
    content_id: contentId,
  };
}

/** Builds graph identity fields for article audio table fixtures. */
function audioIdentity(graph: ReturnType<typeof articleGraphWithContentId>) {
  return {
    ...graph,
    contentType: "article" as const,
    locale: "id" as const,
    route: ARTICLE_ROUTE,
  };
}

/** Builds the shared search/ref projection for one graph identity fixture. */
function contentSearchRef(graph: ReturnType<typeof articleGraphWithContentId>) {
  return {
    ...graph,
    locale: "id" as const,
    markdown_url: `https://nakafa.com/id/${ARTICLE_ROUTE}.mdx`,
    route: ARTICLE_ROUTE,
    section: "articles" as const,
    url: `https://nakafa.com/id/${ARTICLE_ROUTE}`,
  };
}

/** Builds one persisted content route fixture. */
function contentRoute(graph: ReturnType<typeof articleGraphWithContentId>) {
  return {
    ...graph,
    authors: [{ name: "Nakafa Author" }],
    contentHash: "route-hash",
    kind: "article" as const,
    locale: "id" as const,
    markdown: true,
    route: ARTICLE_ROUTE,
    section: "articles" as const,
    sourcePath: ARTICLE_ROUTE,
    syncedAt: NOW,
    title: "Integrity Article",
  };
}

/** Builds one persisted content search fixture. */
function contentSearchDocument(
  graph: ReturnType<typeof articleGraphWithContentId>
) {
  return {
    ...contentSearchRef(graph),
    contentHash: "search-hash",
    description: "Search description",
    sourcePath: ARTICLE_ROUTE,
    syncedAt: NOW,
    text: "Search text",
    title: "Integrity Article",
  };
}

/** Builds one route artifact item fixture. */
function contentRoutePageItem(
  graph: ReturnType<typeof articleGraphWithContentId>
): Doc<"contentRoutePages">["routes"][number] {
  return {
    ...graph,
    authors: [{ name: "Nakafa Author" }],
    kind: "article",
    locale: "id",
    markdown: true,
    route: ARTICLE_ROUTE,
    section: "articles",
    sourcePath: ARTICLE_ROUTE,
    syncedAt: NOW,
    title: "Integrity Article",
  };
}
