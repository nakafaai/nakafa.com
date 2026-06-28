import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { getTestAudioContent } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ARTICLE_SLUG = "articles/politics/audio-playback";
const articleSource = getTestAudioContent({
  contentHash: "article-hash",
  locale: "en",
  route: ARTICLE_SLUG,
});

/** Inserts the compact source row and optional completed audio row. */
async function insertAudioPlaybackFixture(
  t: ReturnType<typeof convexTest>,
  options: { completed: boolean }
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("articleContents", {
      articleSlug: "audio-playback",
      body: "Body intentionally not read by the playback query.",
      category: "politics",
      contentHash: "article-hash",
      date: NOW,
      description: "Article description",
      locale: "en",
      slug: ARTICLE_SLUG,
      syncedAt: NOW,
      title: "Audio Playback",
    });
    const storageId = options.completed
      ? await ctx.storage.store(
          new Blob(["audio bytes"], { type: "audio/wav" })
        )
      : undefined;

    await ctx.db.insert("audioContentSources", {
      ...articleSource,
      syncedAt: NOW,
    });
    await ctx.db.insert("contentAudios", {
      ...articleSource,
      ...(options.completed
        ? { audioDuration: 12_345, audioStorageId: storageId }
        : {}),
      generationAttempts: 1,
      model: "eleven_v3",
      script: "Generated script",
      status: options.completed ? "completed" : "pending",
      updatedAt: NOW,
      voiceId: "voice-1",
    });
  });
}

describe("audioStudies/queries/public", () => {
  it("serves completed audio from the compact source lookup", async () => {
    const t = convexTest(schema, convexModules);

    await insertAudioPlaybackFixture(t, { completed: true });

    const result = await t.query(
      api.audioStudies.queries.public.getAudioBySlug,
      {
        contentType: "article",
        locale: "en",
        slug: ARTICLE_SLUG,
      }
    );

    expect(result).toMatchObject({
      contentType: "article",
      duration: 12.345,
      script: "Generated script",
      status: "completed",
    });
    expect(result?.audioUrl).toContain("/api/storage/");
  });

  it("returns null when the compact source row is missing", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.query(
      api.audioStudies.queries.public.getAudioBySlug,
      {
        contentType: "article",
        locale: "en",
        slug: ARTICLE_SLUG,
      }
    );

    expect(result).toBeNull();
  });

  it("returns null when audio is not completed", async () => {
    const t = convexTest(schema, convexModules);

    await insertAudioPlaybackFixture(t, { completed: false });

    const result = await t.query(
      api.audioStudies.queries.public.getAudioBySlug,
      {
        contentType: "article",
        locale: "en",
        slug: ARTICLE_SLUG,
      }
    );

    expect(result).toBeNull();
  });
});
