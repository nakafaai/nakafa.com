import {
  concatenateAudioBuffers,
  generateAudioScript,
  generateAudioSpeech,
} from "@repo/backend/convex/audioStudies/generation/impl";
import type {
  AudioGenerationProviders,
  AudioGenerationStore,
} from "@repo/backend/convex/audioStudies/generation/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { getTestAudioIdentity } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

function unexpectedCall(name: string): never {
  throw new Error(`Unexpected audio generation test call: ${name}`);
}

const articleRoute = "articles/politics/article";
const articleAudioIdentity = getTestAudioIdentity({
  locale: "en",
  route: articleRoute,
});

describe("audioStudies/generation/impl", () => {
  beforeEach(() => {
    vi.spyOn(logger, "debug").mockImplementation(() => undefined);
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  it("concatenates PCM buffers in order", () => {
    const result = concatenateAudioBuffers([
      new Uint8Array([1, 2]),
      new Uint8Array([3]),
      new Uint8Array([4, 5]),
    ]);

    expect([...result]).toEqual([1, 2, 3, 4, 5]);
  });

  it("generates and saves a script after claiming the audio row", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(async (ctx) => {
      await ctx.db.insert("articleContents", {
        articleSlug: "article",
        body: "Article body",
        category: "politics",
        contentHash: "hash",
        date: 1,
        description: "Description",
        locale: "en",
        slug: articleRoute,
        syncedAt: 1,
        title: "Article",
      });

      const contentAudioId = await ctx.db.insert("contentAudios", {
        ...articleAudioIdentity,
        contentHash: "hash",
        generationAttempts: 0,
        model: "eleven_v3",
        status: "generating-script",
        updatedAt: 1,
        voiceId: "voice",
      });

      return { contentAudioId };
    });
    const calls: string[] = [];
    const store: AudioGenerationStore = {
      claimScriptGeneration: () => {
        calls.push("claimScriptGeneration");
        return Promise.resolve(true);
      },
      claimSpeechGeneration: () => unexpectedCall("claimSpeechGeneration"),
      markFailed: () => unexpectedCall("markFailed"),
      readScriptGenerationData: () => {
        calls.push("readScriptGenerationData");
        return Promise.resolve({
          content: {
            body: "Article body",
            description: "Description",
            locale: "en",
            title: "Article",
          },
          contentAudio: {
            ...articleAudioIdentity,
            contentHash: "hash",
            status: "generating-script",
            voiceId: "voice",
          },
        });
      },
      readSpeechGenerationData: () =>
        unexpectedCall("readSpeechGenerationData"),
      saveAudio: () => unexpectedCall("saveAudio"),
      saveScript: (input) => {
        calls.push(`saveScript:${input.script}`);
        return Promise.resolve(null);
      },
      verifyContentHash: () => {
        calls.push("verifyContentHash");
        return Promise.resolve(true);
      },
    };
    const providers: AudioGenerationProviders = {
      defaultVoiceSettings: {},
      generateScriptText: (content) => {
        calls.push(`generateScriptText:${content.title}`);
        return Promise.resolve("Generated script");
      },
      generateSpeechChunk: () => unexpectedCall("generateSpeechChunk"),
      storeAudio: () => unexpectedCall("storeAudio"),
    };

    const result = await Effect.runPromise(
      generateAudioScript(store, providers, {
        contentAudioId: ids.contentAudioId,
      })
    );

    expect(result).toBeNull();
    expect(calls).toEqual([
      "claimScriptGeneration",
      "readScriptGenerationData",
      "verifyContentHash",
      "generateScriptText:Article",
      "verifyContentHash",
      "saveScript:Generated script",
    ]);
  });

  it("marks a claimed script row failed when content changes", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(async (ctx) => {
      await ctx.db.insert("articleContents", {
        articleSlug: "article",
        body: "Article body",
        category: "politics",
        contentHash: "hash",
        date: 1,
        locale: "en",
        slug: articleRoute,
        syncedAt: 1,
        title: "Article",
      });
      const contentAudioId = await ctx.db.insert("contentAudios", {
        ...articleAudioIdentity,
        contentHash: "hash",
        generationAttempts: 0,
        model: "eleven_v3",
        status: "generating-script",
        updatedAt: 1,
        voiceId: "voice",
      });

      return { contentAudioId };
    });
    const failedMessages: string[] = [];
    const store: AudioGenerationStore = {
      claimScriptGeneration: () => Promise.resolve(true),
      claimSpeechGeneration: () => unexpectedCall("claimSpeechGeneration"),
      markFailed: (input) => {
        failedMessages.push(input.error);
        return Promise.resolve(null);
      },
      readScriptGenerationData: () =>
        Promise.resolve({
          content: {
            body: "Article body",
            locale: "en",
            title: "Article",
          },
          contentAudio: {
            ...articleAudioIdentity,
            contentHash: "hash",
            status: "generating-script",
            voiceId: "voice",
          },
        }),
      readSpeechGenerationData: () =>
        unexpectedCall("readSpeechGenerationData"),
      saveAudio: () => unexpectedCall("saveAudio"),
      saveScript: () => unexpectedCall("saveScript"),
      verifyContentHash: () => Promise.resolve(false),
    };
    const providers: AudioGenerationProviders = {
      defaultVoiceSettings: {},
      generateScriptText: () => unexpectedCall("generateScriptText"),
      generateSpeechChunk: () => unexpectedCall("generateSpeechChunk"),
      storeAudio: () => unexpectedCall("storeAudio"),
    };

    const program = generateAudioScript(store, providers, {
      contentAudioId: ids.contentAudioId,
    });

    await expect(runConvexProgram(program)).rejects.toMatchObject({
      data: {
        code: "CONTENT_CHANGED",
        message: "Content changed during generation, aborting to save costs",
      },
    });
    expect(failedMessages).toEqual([
      "Content changed during generation, aborting to save costs",
    ]);
  });

  it("generates speech chunks and saves WAV metadata", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.run(async (ctx) => {
      await ctx.db.insert("articleContents", {
        articleSlug: "article",
        body: "Article body",
        category: "politics",
        contentHash: "hash",
        date: 1,
        locale: "en",
        slug: articleRoute,
        syncedAt: 1,
        title: "Article",
      });
      const storageId = await ctx.storage.store(
        new Blob(["generated audio"], { type: "audio/wav" })
      );
      const contentAudioId = await ctx.db.insert("contentAudios", {
        ...articleAudioIdentity,
        contentHash: "hash",
        generationAttempts: 0,
        model: "eleven_v3",
        script: "Hello world.",
        status: "generating-speech",
        updatedAt: 1,
        voiceId: "voice",
      });

      return { contentAudioId, storageId };
    });
    const calls: string[] = [];
    const savedAudio: Array<{ duration: number; size: number }> = [];
    const store: AudioGenerationStore = {
      claimScriptGeneration: () => unexpectedCall("claimScriptGeneration"),
      claimSpeechGeneration: () => {
        calls.push("claimSpeechGeneration");
        return Promise.resolve(true);
      },
      markFailed: () => unexpectedCall("markFailed"),
      readScriptGenerationData: () =>
        unexpectedCall("readScriptGenerationData"),
      readSpeechGenerationData: () => {
        calls.push("readSpeechGenerationData");
        return Promise.resolve({
          contentHash: "hash",
          model: "eleven_v3",
          script: "Hello world.",
          voiceId: "voice",
        });
      },
      saveAudio: (input) => {
        calls.push("saveAudio");
        savedAudio.push({ duration: input.duration, size: input.size });
        return Promise.resolve(null);
      },
      saveScript: () => unexpectedCall("saveScript"),
      verifyContentHash: () => {
        calls.push("verifyContentHash");
        return Promise.resolve(true);
      },
    };
    const providers: AudioGenerationProviders = {
      defaultVoiceSettings: {},
      generateScriptText: () => unexpectedCall("generateScriptText"),
      generateSpeechChunk: (input) => {
        calls.push(`generateSpeechChunk:${input.text}`);
        return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
      },
      storeAudio: () => {
        calls.push("storeAudio");
        return Promise.resolve(ids.storageId);
      },
    };

    const result = await Effect.runPromise(
      generateAudioSpeech(store, providers, {
        contentAudioId: ids.contentAudioId,
      })
    );

    expect(result).toBeNull();
    expect(calls).toEqual([
      "claimSpeechGeneration",
      "readSpeechGenerationData",
      "verifyContentHash",
      "generateSpeechChunk:Hello world.",
      "verifyContentHash",
      "storeAudio",
      "saveAudio",
    ]);
    expect(savedAudio).toEqual([
      expect.objectContaining({
        duration: expect.any(Number),
        size: expect.any(Number),
      }),
    ]);
    expect(savedAudio[0]?.duration).toBeGreaterThanOrEqual(0);
    expect(savedAudio[0]?.size).toBeGreaterThan(4);
  });
});
