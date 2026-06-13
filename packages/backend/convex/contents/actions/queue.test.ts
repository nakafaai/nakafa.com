import { internal } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { MIN_VIEW_THRESHOLD } from "@repo/backend/convex/audioStudies/constants";
import {
  chunkPopularAudioItems,
  populateAudioGenerationQueue,
} from "@repo/backend/convex/contents/audioQueue/impl";
import { audioQueuePopulationFailedCode } from "@repo/backend/convex/contents/audioQueue/spec";
import type { PopularAudioContentItem } from "@repo/backend/convex/contents/validators";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/dynastic-politics-asian-values";

describe("contents/actions/queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.stubEnv("ENABLE_AUDIO_GENERATION", "true");
    vi.spyOn(logger, "debug").mockImplementation(() => undefined);
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("chunks popular audio candidates into bounded mutation batches", async () => {
    const t = convexTest(schema, convexModules);
    const items = await t.mutation(async (ctx) => {
      const rows: PopularAudioContentItem[] = [];

      for (let index = 0; index < 25; index++) {
        const articleId = await ctx.db.insert("articleContents", {
          articleSlug: `article-${index}`,
          body: "Body",
          category: "politics",
          contentHash: `hash-${index}`,
          date: index,
          description: "Description",
          locale: "en",
          slug: `articles/politics/article-${index}`,
          syncedAt: index,
          title: `Article ${index}`,
        });

        rows.push({
          ref: { type: "article", id: articleId },
          viewCount: 25 - index,
        });
      }

      return rows;
    });

    const chunks = chunkPopularAudioItems(items);

    expect(chunks.map((chunk) => chunk.length)).toEqual([10, 10, 5]);
    expect(chunks.flat()).toEqual(items);
  });

  it("returns without queue writes when there is no popular content", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.action(
      internal.contents.actions.queue.populateAudioQueue
    );
    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toBeNull();
    expect(queuedItems).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      "No popular content found for audio queue population"
    );
  });

  it("skips queue population when audio generation is disabled", async () => {
    vi.stubEnv("ENABLE_AUDIO_GENERATION", "false");
    const ctx = {
      runMutation: () =>
        Promise.reject(new Error("Queue mutation should not run.")),
      runQuery: () =>
        Promise.reject(new Error("Popularity read should not run.")),
    } satisfies Pick<ActionCtx, "runMutation" | "runQuery">;

    const result = await Effect.runPromise(
      populateAudioGenerationQueue(ctx, {
        enqueuePopularContent:
          internal.contents.mutations.audio.enqueuePopularContentForAudio,
        readPopularContent:
          internal.contents.queries.audio.getPopularContentForAudioQueue,
      })
    );

    expect(result).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      "Audio queue population skipped - ENABLE_AUDIO_GENERATION not set"
    );
  });

  it("maps popularity read failures to the typed queue population error", async () => {
    const readFailure = new Error("popular content read failed");
    const ctx = {
      runMutation: () =>
        Promise.reject(
          new Error("Queue mutation should not run after read failure.")
        ),
      runQuery: () => Promise.reject(readFailure),
    } satisfies Pick<ActionCtx, "runMutation" | "runQuery">;

    const error = await Effect.runPromise(
      Effect.flip(
        populateAudioGenerationQueue(ctx, {
          enqueuePopularContent:
            internal.contents.mutations.audio.enqueuePopularContentForAudio,
          readPopularContent:
            internal.contents.queries.audio.getPopularContentForAudioQueue,
        })
      )
    );

    expect(error).toMatchObject({
      _tag: "AudioQueuePopulationError",
      code: audioQueuePopulationFailedCode,
      message: readFailure.message,
    });
  });

  it("reads popular content and enqueues bounded audio work", async () => {
    const t = convexTest(schema, convexModules);

    const articleId = await t.mutation(async (ctx) => {
      const articleId = await ctx.db.insert("articleContents", {
        articleSlug: "dynastic-politics-asian-values",
        body: "Article body",
        category: "politics",
        contentHash: "article-hash",
        date: NOW,
        description: "Article description",
        locale: "en",
        slug: ARTICLE_ROUTE,
        syncedAt: NOW,
        title: "Dynastic Politics",
      });
      const graph = createLearningGraphIdentityFromRoute({
        locale: "en",
        route: ARTICLE_ROUTE,
      });

      if (!graph) {
        throw new Error(`Expected graph identity for ${ARTICLE_ROUTE}.`);
      }

      await ctx.db.insert("contentRoutes", {
        ...graph,
        authors: [],
        contentHash: "route-hash",
        content_id: graph.assetId,
        kind: "article",
        locale: "en",
        markdown: true,
        route: ARTICLE_ROUTE,
        section: "articles",
        syncedAt: NOW,
        title: "Dynastic Politics",
      });

      await ctx.db.insert("articlePopularity", {
        ...graph,
        content_id: graph.assetId,
        updatedAt: NOW,
        viewCount: MIN_VIEW_THRESHOLD,
      });
      await ctx.db.insert("audioContentSources", {
        contentHash: "article-hash",
        contentRef: { type: "article", id: articleId },
        locale: "en",
        slug: ARTICLE_ROUTE,
        syncedAt: NOW,
      });

      return articleId;
    });

    const result = await t.action(
      internal.contents.actions.queue.populateAudioQueue
    );
    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toBeNull();
    expect(queuedItems).toEqual([
      expect.objectContaining({
        contentRef: { id: articleId, type: "article" },
        locale: "en",
        priorityScore: MIN_VIEW_THRESHOLD * 10,
        requestedAt: NOW,
        retryCount: 0,
        status: "pending",
        updatedAt: NOW,
      }),
    ]);
  });
});
