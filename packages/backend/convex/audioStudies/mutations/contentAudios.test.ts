import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const contentHash = "audio-hash";

async function seedSubject(ctx: MutationCtx) {
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: "subject/high-school/10/mathematics/audio",
    syncedAt: 1,
    title: "Audio Topic",
    topic: "audio",
  });

  return await ctx.db.insert("subjectSections", {
    body: "Audio body",
    category: "high-school",
    contentHash,
    date: 1,
    description: "Audio description",
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    section: "intro",
    slug: "subject/high-school/10/mathematics/audio/intro",
    subject: "Audio",
    syncedAt: 1,
    title: "Audio Intro",
    topic: "audio",
    topicId,
  });
}

async function seedAudio(ctx: MutationCtx, subjectId: Id<"subjectSections">) {
  return await ctx.db.insert("contentAudios", {
    contentHash,
    contentRef: { type: "subject", id: subjectId },
    generationAttempts: 0,
    locale: "en",
    model: "eleven_v3",
    status: "pending",
    updatedAt: 1,
    voiceId: "voice",
  });
}

describe("audioStudies/mutations/contentAudios", () => {
  it("claims and saves script and speech generation state", async () => {
    const t = convexTest(schema, convexModules);
    const { audioId, storageId } = await t.run(async (ctx) => {
      const subjectId = await seedSubject(ctx);
      return {
        audioId: await seedAudio(ctx, subjectId),
        storageId: await ctx.storage.store(
          new Blob(["audio"], { type: "audio/wav" })
        ),
      };
    });

    await expect(
      t.mutation(
        internal.audioStudies.mutations.contentAudios.claimScriptGeneration,
        { contentAudioId: audioId }
      )
    ).resolves.toBe(true);
    await t.mutation(internal.audioStudies.mutations.contentAudios.saveScript, {
      contentAudioId: audioId,
      script: "Generated script",
    });
    await expect(
      t.mutation(
        internal.audioStudies.mutations.contentAudios.claimSpeechGeneration,
        { contentAudioId: audioId }
      )
    ).resolves.toBe(true);
    await t.mutation(internal.audioStudies.mutations.contentAudios.saveAudio, {
      contentAudioId: audioId,
      duration: 1200,
      size: 512,
      storageId,
    });

    const audio = await t.run(
      async (ctx) => await ctx.db.get("contentAudios", audioId)
    );

    expect(audio).toMatchObject({
      audioDuration: 1200,
      audioSize: 512,
      audioStorageId: storageId,
      script: "Generated script",
      status: "completed",
    });
  });

  it("resets failed generation steps to the next retryable status", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.run(async (ctx) => {
      const subjectId = await seedSubject(ctx);
      const scriptAudioId = await seedAudio(ctx, subjectId);
      const speechAudioId = await seedAudio(ctx, subjectId);

      await ctx.db.patch("contentAudios", scriptAudioId, {
        generationAttempts: 1,
        status: "generating-script",
      });
      await ctx.db.patch("contentAudios", speechAudioId, {
        generationAttempts: 2,
        status: "generating-speech",
      });

      return { scriptAudioId, speechAudioId };
    });

    await t.mutation(internal.audioStudies.mutations.contentAudios.markFailed, {
      contentAudioId: ids.scriptAudioId,
      error: "script failed",
    });
    await t.mutation(internal.audioStudies.mutations.contentAudios.markFailed, {
      contentAudioId: ids.speechAudioId,
      error: "speech failed",
    });

    const [scriptAudio, speechAudio] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get("contentAudios", ids.scriptAudioId),
        ctx.db.get("contentAudios", ids.speechAudioId),
      ])
    );

    expect(scriptAudio).toMatchObject({
      errorMessage: "script failed",
      generationAttempts: 2,
      status: "pending",
    });
    expect(speechAudio).toMatchObject({
      errorMessage: "speech failed",
      generationAttempts: 3,
      status: "script-generated",
    });
  });

  it("reuses stale duplicate audio rows by keeping one reset row", async () => {
    const t = convexTest(schema, convexModules);
    const { duplicateId, keeperId, subjectId } = await t.run(async (ctx) => {
      const subjectId = await seedSubject(ctx);
      const keeperId = await seedAudio(ctx, subjectId);
      const duplicateId = await seedAudio(ctx, subjectId);

      await ctx.db.patch("contentAudios", keeperId, {
        audioDuration: 42,
        contentHash: "stale-hash",
        script: "stale",
        status: "completed",
      });

      return { duplicateId, keeperId, subjectId };
    });

    const resultId = await t.mutation(
      internal.audioStudies.mutations.contentAudios.createOrGetAudioRecord,
      {
        contentHash: "fresh-hash",
        contentRef: { type: "subject", id: subjectId },
        locale: "en",
      }
    );
    const rows = await t.run(
      async (ctx) => await ctx.db.query("contentAudios").collect()
    );

    expect(resultId).toBe(keeperId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      _id: keeperId,
      contentHash: "fresh-hash",
      generationAttempts: 0,
      status: "pending",
    });
    expect(rows[0]?.script).toBeUndefined();
    expect(rows[0]?.audioDuration).toBeUndefined();
    expect(
      await t.run(async (ctx) => await ctx.db.get("contentAudios", duplicateId))
    ).toBeNull();
  });
});
