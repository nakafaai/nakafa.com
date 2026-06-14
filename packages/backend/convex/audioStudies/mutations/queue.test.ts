import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { getTestAudioIdentity } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const OLD_ENOUGH_FOR_CLEANUP = NOW - 31 * 24 * 60 * 60 * 1000;
const articleRoute = "articles/politics/audio-cleanup";
const englishArticleIdentity = getTestAudioIdentity({
  locale: "en",
  route: articleRoute,
});
const indonesianArticleIdentity = getTestAudioIdentity({
  locale: "id",
  route: articleRoute,
});

describe("audioStudies/mutations/queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.stubEnv("ENABLE_AUDIO_GENERATION", "false");
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("removes disabled audio backlog and incomplete audio rows", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("articleContents", {
        articleSlug: "audio-cleanup",
        body: "Body",
        category: "politics",
        contentHash: "hash",
        date: NOW,
        description: "Description",
        locale: "en",
        slug: articleRoute,
        syncedAt: NOW,
        title: "Audio cleanup",
      });

      await ctx.db.insert("audioGenerationQueue", {
        ...englishArticleIdentity,
        maxRetries: 3,
        priorityScore: 100,
        requestedAt: NOW,
        retryCount: 0,
        status: "pending",
        updatedAt: NOW,
      });
      await ctx.db.insert("audioGenerationQueue", {
        ...indonesianArticleIdentity,
        maxRetries: 3,
        priorityScore: 90,
        processingStartedAt: NOW,
        requestedAt: NOW,
        retryCount: 0,
        status: "processing",
        updatedAt: NOW,
      });
      await ctx.db.insert("audioGenerationQueue", {
        ...englishArticleIdentity,
        errorMessage: "provider disabled",
        lastErrorAt: NOW,
        maxRetries: 3,
        priorityScore: 80,
        requestedAt: NOW,
        retryCount: 1,
        status: "failed",
        updatedAt: NOW,
      });
      await ctx.db.insert("audioGenerationQueue", {
        ...englishArticleIdentity,
        completedAt: OLD_ENOUGH_FOR_CLEANUP,
        maxRetries: 3,
        priorityScore: 70,
        requestedAt: OLD_ENOUGH_FOR_CLEANUP,
        retryCount: 0,
        status: "completed",
        updatedAt: OLD_ENOUGH_FOR_CLEANUP,
      });

      await ctx.db.insert("contentAudios", {
        ...englishArticleIdentity,
        contentHash: "hash",
        generationAttempts: 0,
        model: "eleven_v3",
        status: "pending",
        updatedAt: NOW,
        voiceId: "voice",
      });
      await ctx.db.insert("contentAudios", {
        ...indonesianArticleIdentity,
        contentHash: "hash",
        generationAttempts: 1,
        model: "eleven_v3",
        status: "completed",
        updatedAt: NOW,
        voiceId: "voice",
      });
    });

    const result = await t.mutation(
      internal.audioStudies.mutations.queue.cleanup
    );
    const rows = await t.query(async (ctx) => ({
      audios: await ctx.db.query("contentAudios").collect(),
      queue: await ctx.db.query("audioGenerationQueue").collect(),
    }));

    expect(result).toEqual({ deleted: 5 });
    expect(rows.queue).toEqual([]);
    expect(rows.audios).toHaveLength(1);
    expect(rows.audios[0]?.status).toBe("completed");
  });
});
