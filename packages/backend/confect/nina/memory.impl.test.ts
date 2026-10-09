import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MEMORY_FACTS,
  type NinaMemoryChanges,
} from "@repo/backend/confect/nina/memory.spec";
import { createNinaTest } from "@repo/backend/test/nina";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Array as Arr, Option } from "effect";

const get = Ref.getFunctionReference(refs.public.nina.memory.get);
const enable = Ref.getFunctionReference(refs.public.nina.memory.enable);
const disable = Ref.getFunctionReference(refs.public.nina.memory.disable);
const forget = Ref.getFunctionReference(refs.public.nina.memory.forget);
const read = Ref.getFunctionReference(refs.internal.nina.memory.read);
const apply = Ref.getFunctionReference(refs.internal.nina.memory.apply);
const call = { input: 300, output: 20 };
const none: typeof NinaMemoryChanges.Type = {
  forget: [],
  remember: [],
  update: [],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * A learner with a chat and a way to store one curation from it, against the
 * memory revision the curation read (the current one by default).
 */
async function fixture() {
  const f = await createNinaTest();
  const userId = f.identity.userId;
  const stored = () =>
    f.t.query((ctx) => ctx.db.query("ninaMemories").collect());
  const revision = async () => {
    const [memory] = await stored();
    if (!memory) {
      throw new Error("Expected one memory document.");
    }
    return { id: memory._id, revision: memory.updatedAt };
  };
  const curate = async (
    changes: Partial<typeof NinaMemoryChanges.Type>,
    memory?: Awaited<ReturnType<typeof revision>>
  ) =>
    f.t.mutation(apply, {
      changes: { ...none, ...changes },
      chatId: f.chatId,
      memory: memory ?? (await revision()),
      usage: call,
      userId,
    });
  return { ...f, curate, revision, stored, userId };
}

describe("Nina learner memory", () => {
  it("keeps nothing until the learner turns memory on and forgets it all when turned off", async () => {
    const f = await fixture();
    expect(await f.owner.query(get, {})).toBeNull();
    expect(await f.owner.mutation(enable, {})).toEqual({ facts: [] });
    const before = await f.revision();
    await f.owner.mutation(disable, {});
    await f.curate({ remember: ["Kelas 12."] }, before);
    expect(await f.stored()).toEqual([]);
    expect(await f.owner.mutation(enable, {})).toEqual({ facts: [] });
    vi.setSystemTime(1000);
    await f.curate({ remember: ["Kelas 12."] });
    expect(await f.owner.mutation(enable, {})).toEqual({
      facts: [{ key: 0, savedAt: 1000, text: "Kelas 12." }],
    });
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        next: 1,
        usage: { calls: 1, input: 300, output: 20 },
      }),
    ]);
    expect(await f.owner.mutation(disable, {})).toBeNull();
    expect(await f.owner.mutation(disable, {})).toBeNull();
    expect(await f.owner.query(get, {})).toBeNull();
    expect(await f.stored()).toEqual([]);
  });

  it("rewrites, forgets, and skips repeated facts, keeping the most recently saved", async () => {
    const f = await fixture();
    await f.owner.mutation(enable, {});
    vi.setSystemTime(1000);
    await f.curate({ remember: ["Kelas 12.", "Suka contoh.", "Ikut SNBT."] });
    vi.setSystemTime(2000);
    await f.curate({
      forget: [1, 1],
      remember: ["ikut snbt.", "Sulit di peluang.", "Sulit di peluang."],
      update: [
        { key: 0, text: "Kelas 11." },
        { key: 1, text: "Dropped by forget." },
      ],
    });
    expect(await f.owner.query(get, {})).toEqual({
      facts: [
        { key: 3, savedAt: 2000, text: "Sulit di peluang." },
        { key: 0, savedAt: 2000, text: "Kelas 11." },
        { key: 2, savedAt: 1000, text: "Ikut SNBT." },
      ],
    });
    for (let batch = 0; batch < MEMORY_FACTS / 3; batch += 1) {
      await f.curate({
        remember: Arr.map([0, 1, 2], (item) => `Fakta ${batch}-${item}.`),
      });
    }
    const view = await f.owner.query(get, {});
    expect(view?.facts).toHaveLength(MEMORY_FACTS);
    expect(view?.facts[0]?.text).toBe("Fakta 9-2.");
    expect(Option.getOrThrow(Arr.last(view?.facts ?? [])).text).toBe(
      "Fakta 0-0."
    );
  });

  it("changes nothing from a curation that raced a newer write, but counts it", async () => {
    const f = await fixture();
    await f.owner.mutation(enable, {});
    const read = await f.revision();
    vi.setSystemTime(1000);
    await f.curate({ remember: ["Kelas 12."] }, read);
    vi.setSystemTime(2000);
    await f.curate({ update: [{ key: 0, text: "Kelas 11." }] }, read);
    expect(await f.owner.query(get, {})).toEqual({
      facts: [{ key: 0, savedAt: 1000, text: "Kelas 12." }],
    });
    expect(await f.stored()).toEqual([
      expect.objectContaining({ usage: { calls: 2, input: 600, output: 40 } }),
    ]);
  });

  it("changes nothing from a curation read before memory was reset", async () => {
    const f = await fixture();
    await f.owner.mutation(enable, {});
    const read = await f.revision();
    await f.owner.mutation(disable, {});
    await f.owner.mutation(enable, {});
    await f.curate({ remember: ["Kelas 12."] }, read);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        facts: [],
        usage: { calls: 1, input: 300, output: 20 },
      }),
    ]);
  });

  it("forgets one fact by key and ignores unknown keys", async () => {
    const f = await fixture();
    expect(await f.owner.mutation(forget, { key: 0 })).toBeNull();
    await f.owner.mutation(enable, {});
    vi.setSystemTime(1000);
    await f.curate({ remember: ["Kelas 12.", "Suka contoh."] });
    expect(await f.owner.mutation(forget, { key: 7 })).toEqual({
      facts: [
        { key: 1, savedAt: 1000, text: "Suka contoh." },
        { key: 0, savedAt: 1000, text: "Kelas 12." },
      ],
    });
    expect(await f.owner.mutation(forget, { key: 0 })).toEqual({
      facts: [{ key: 1, savedAt: 1000, text: "Suka contoh." }],
    });
    expect(await f.t.query(get, {})).toBeNull();
  });

  it("keeps no facts from a chat deleted before curation finished but counts the call", async () => {
    const f = await fixture();
    await f.owner.mutation(enable, {});
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.chatId));
    await f.curate({ remember: ["Kelas 12."] });
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        facts: [],
        next: 0,
        usage: { calls: 1, input: 300, output: 20 },
      }),
    ]);
  });

  it("reads remembered facts only while memory is on", async () => {
    const f = await fixture();
    expect(await f.t.query(read, { userId: f.userId })).toEqual({
      memory: null,
      profile: {},
    });
    await f.owner.mutation(enable, {});
    await f.curate({ remember: ["Kelas 12."] });
    const [memory] = await f.stored();
    expect(await f.t.query(read, { userId: f.userId })).toEqual({
      memory: {
        facts: [{ key: 0, text: "Kelas 12." }],
        id: memory?._id,
        revision: memory?.updatedAt,
      },
      profile: {},
    });
  });

  it("reads the account profile with the latest finished try-out by section", async () => {
    const f = await fixture();
    const userId = await f.t.mutation(async (ctx) => {
      const runtime = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "memory-profile",
      });
      const { userId: owner } = runtime.identity;
      await ctx.db.insert("onboardingProfiles", {
        focus: "tryout",
        region: "indonesia",
        updatedAt: 1,
        userId: owner,
      });
      await ctx.db.insert("learningPreferences", {
        preferredTryoutCountryKey: "indonesia",
        updatedAt: 1,
        userId: owner,
      });
      const attempt = await ctx.db.get("tryoutAttempts", runtime.attemptId);
      if (!attempt) {
        return Promise.reject(new Error("Fixture attempt missing"));
      }
      await ctx.db.insert("tryoutScores", {
        finalizedAt: Date.UTC(2026, 8, 12),
        publishedScore: 612,
        rawScore: 1,
        scoreStatus: "provisional",
        scoringStrategy: "raw",
        setIdentity: attempt.setIdentity,
        totalCorrect: 1,
        totalQuestions: 1,
        tryoutAttemptId: attempt._id,
        tryoutSnapshotId: attempt.tryoutSnapshotId,
        userId: owner,
      });
      return owner;
    });
    expect(await f.t.query(read, { userId })).toEqual({
      memory: null,
      profile: {
        focus: "tryout",
        region: "indonesia",
        tryout: {
          correct: 1,
          exam: "snbt",
          finishedAt: Date.UTC(2026, 8, 12),
          score: 612,
          sections: [{ correct: 0, key: "penalaran-matematika", total: 1 }],
          set: "set-1",
          status: "provisional",
          total: 1,
        },
        tryoutCountry: "indonesia",
      },
    });
  });

  it("reads no try-out when the scored attempt is gone", async () => {
    const f = await fixture();
    const userId = await f.t.mutation(async (ctx) => {
      const runtime = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "memory-orphan",
      });
      const attempt = await ctx.db.get("tryoutAttempts", runtime.attemptId);
      if (!attempt) {
        return Promise.reject(new Error("Fixture attempt missing"));
      }
      await ctx.db.insert("tryoutScores", {
        finalizedAt: 1,
        publishedScore: 500,
        rawScore: 1,
        scoreStatus: "official",
        scoringStrategy: "raw",
        setIdentity: attempt.setIdentity,
        totalCorrect: 1,
        totalQuestions: 1,
        tryoutAttemptId: attempt._id,
        tryoutSnapshotId: attempt.tryoutSnapshotId,
        userId: runtime.identity.userId,
      });
      await ctx.db.delete("tryoutAttempts", attempt._id);
      return runtime.identity.userId;
    });
    expect(await f.t.query(read, { userId })).toEqual({
      memory: null,
      profile: {},
    });
  });
});
