import {
  fetchContentForAudio,
  getResetAudioFields,
  updateContentHash,
} from "@repo/backend/convex/audioStudies/utils";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const publishedAt = 1_744_416_000_000;

const articleContent = {
  articleSlug: "dynastic-politics-asian-values",
  body: "The legitimacy of dynastic politics is increasing.",
  category: "politics" as const,
  contentHash: "article-hash",
  date: publishedAt,
  description: "Power is passed down under a familiar political frame.",
  locale: "en" as const,
  slug: "articles/politics/dynastic-politics-asian-values",
  syncedAt: 1,
  title: "Framing Dynastic Politics",
};

const sectionContent = {
  body: "Vector addition considers both magnitude and direction.",
  category: "high-school" as const,
  contentHash: "section-hash",
  date: publishedAt,
  description: "Master vector addition with geometric methods.",
  grade: "10" as const,
  locale: "en" as const,
  material: "mathematics" as const,
  section: "vector-addition",
  slug: "subject/high-school/10/mathematics/vector/vector-addition",
  subject: "Vector and Operations",
  syncedAt: 1,
  title: "Vector Addition",
  topic: "vector",
};

const sectionTopic = {
  category: sectionContent.category,
  grade: sectionContent.grade,
  locale: sectionContent.locale,
  material: sectionContent.material,
  sectionCount: 1,
  slug: "subject/high-school/10/mathematics/vector",
  syncedAt: 1,
  title: sectionContent.subject,
  topic: sectionContent.topic,
};

describe("audioStudies/utils", () => {
  it("loads the full content needed for audio generation", async () => {
    const t = convexTest(schema, convexModules);

    const { articleId, sectionId } = await t.mutation(async (ctx) => {
      const topicId = await ctx.db.insert("subjectTopics", sectionTopic);

      return {
        articleId: await ctx.db.insert("articleContents", articleContent),
        sectionId: await ctx.db.insert("subjectSections", {
          ...sectionContent,
          topicId,
        }),
      };
    });

    const result = await t.query(async (ctx) => ({
      article: await fetchContentForAudio(ctx, {
        type: "article",
        id: articleId,
      }),
      section: await fetchContentForAudio(ctx, {
        type: "subject",
        id: sectionId,
      }),
    }));

    expect(result).toEqual({
      article: {
        body: articleContent.body,
        description: articleContent.description,
        locale: articleContent.locale,
        title: articleContent.title,
      },
      section: {
        body: sectionContent.body,
        description: sectionContent.description,
        locale: sectionContent.locale,
        title: sectionContent.title,
      },
    });
  });

  it("returns null when the source content row is gone", async () => {
    const t = convexTest(schema, convexModules);

    const { articleId, sectionId } = await t.mutation(async (ctx) => {
      const articleId = await ctx.db.insert("articleContents", articleContent);
      const topicId = await ctx.db.insert("subjectTopics", sectionTopic);
      const sectionId = await ctx.db.insert("subjectSections", {
        ...sectionContent,
        topicId,
      });

      await ctx.db.delete("articleContents", articleId);
      await ctx.db.delete("subjectSections", sectionId);

      return { articleId, sectionId };
    });

    const result = await t.query(async (ctx) => ({
      article: await fetchContentForAudio(ctx, {
        type: "article",
        id: articleId,
      }),
      section: await fetchContentForAudio(ctx, {
        type: "subject",
        id: sectionId,
      }),
    }));

    expect(result).toEqual({
      article: null,
      section: null,
    });
  });

  it("returns reset fields with a fresh pending state", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(123_456_789);

    expect(getResetAudioFields("next-hash")).toEqual({
      audioDuration: undefined,
      audioSize: undefined,
      audioStorageId: undefined,
      contentHash: "next-hash",
      errorMessage: undefined,
      failedAt: undefined,
      generationAttempts: 0,
      script: undefined,
      status: "pending",
      updatedAt: 123_456_789,
    });

    nowSpy.mockRestore();
  });

  it("skips resetting audio rows when the hash is unchanged", async () => {
    const t = convexTest(schema, convexModules);

    const sectionId = await t.mutation(async (ctx) => {
      const topicId = await ctx.db.insert("subjectTopics", sectionTopic);
      const sectionId = await ctx.db.insert("subjectSections", {
        ...sectionContent,
        topicId,
      });

      await ctx.db.insert("contentAudios", {
        contentHash: sectionContent.contentHash,
        contentRef: { type: "subject", id: sectionId },
        generationAttempts: 2,
        locale: sectionContent.locale,
        model: "eleven_v3",
        script: "script",
        status: "completed",
        updatedAt: 5,
        voiceId: "voice-1",
      });

      return sectionId;
    });

    const updatedCount = await t.mutation(
      async (ctx) =>
        await updateContentHash(
          ctx,
          { type: "subject", id: sectionId },
          sectionContent.contentHash
        )
    );

    expect(updatedCount).toBe(0);
  });

  it("resets changed audio rows and clears stale generated files", async () => {
    const t = convexTest(schema, convexModules);

    const { audioId, sectionId } = await t.run(async (ctx) => {
      const topicId = await ctx.db.insert("subjectTopics", sectionTopic);
      const sectionId = await ctx.db.insert("subjectSections", {
        ...sectionContent,
        topicId,
      });
      const storageId = await ctx.storage.store(
        new Blob(["stale audio bytes"], { type: "audio/wav" })
      );
      const audioId = await ctx.db.insert("contentAudios", {
        audioDuration: 42,
        audioSize: 7,
        audioStorageId: storageId,
        contentHash: "old-hash",
        contentRef: { type: "subject", id: sectionId },
        errorMessage: "old error",
        failedAt: 8,
        generationAttempts: 3,
        locale: sectionContent.locale,
        model: "eleven_v3",
        script: "old script",
        status: "completed",
        updatedAt: 9,
        voiceId: "voice-1",
      });

      return { audioId, sectionId };
    });

    const updatedCount = await t.mutation(
      async (ctx) =>
        await updateContentHash(
          ctx,
          { type: "subject", id: sectionId },
          sectionContent.contentHash
        )
    );

    const audio = await t.query(
      async (ctx) => await ctx.db.get("contentAudios", audioId)
    );

    expect(updatedCount).toBe(1);
    expect(audio).toMatchObject({
      contentHash: sectionContent.contentHash,
      generationAttempts: 0,
      status: "pending",
    });
    expect(audio?.audioDuration).toBeUndefined();
    expect(audio?.audioSize).toBeUndefined();
    expect(audio?.audioStorageId).toBeUndefined();
    expect(audio?.errorMessage).toBeUndefined();
    expect(audio?.failedAt).toBeUndefined();
    expect(audio?.script).toBeUndefined();
  });
});
