import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { EXPIRY_PAGE } from "@repo/backend/confect/nina/memory/store";
import type { NinaLearner } from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr } from "effect";

const memory = refs.public.nina.memory;
const list = Ref.getFunctionReference(memory.list);
const remove = Ref.getFunctionReference(memory.remove);
const pause = Ref.getFunctionReference(memory.pause);
const clear = Ref.getFunctionReference(memory.clear);
const read = Ref.getFunctionReference(refs.internal.nina.memory.read);
const expire = Ref.getFunctionReference(refs.internal.nina.memory.expire);

const NOW = Date.UTC(2026, 9, 10, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** The words of each memory Nina reads, in the order she reads them. */
function prompted(learner: Pick<typeof NinaLearner.Type, "prompt">) {
  return Arr.map(learner.prompt, (item) => item.text);
}

describe("Nina memory removal", () => {
  it("removes one memory, and ignores a memory that is gone", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ text: "Goes" });
    await f.seed({ text: "Stays" });
    expect(await f.owner.mutation(remove, { id })).toBeNull();
    expect(await f.owner.mutation(remove, { id })).toBeNull();
    expect(await f.texts()).toEqual(["Stays"]);
  });

  it("clears every memory of the learner and no one else's", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Mine" });
    await f.seed({ author: "learner", text: "Also mine" });
    await f.seed({ text: "Theirs", userId: other.userId });
    expect(await f.owner.mutation(clear, {})).toBeNull();
    expect(await f.texts()).toEqual([]);
    expect(await f.texts(other.userId)).toEqual(["Theirs"]);
  });
});

describe("Nina memory pause", () => {
  it("pauses without deleting, resumes, and creates the preference only when it must", async () => {
    const f = await createMemoryTest();
    const preferences = () =>
      f.t.query((ctx) => ctx.db.query("learningPreferences").collect());
    const stranger = await f.stranger();
    expect(await stranger.owner.mutation(pause, { paused: false })).toBeNull();
    expect(await preferences()).toEqual([]);
    await f.seed({ author: "learner", text: "Kept" });
    vi.setSystemTime(1000);
    await f.owner.mutation(pause, { paused: true });
    expect(await preferences()).toEqual([
      expect.objectContaining({ ninaMemoryPaused: true, updatedAt: 1000 }),
    ]);
    vi.setSystemTime(2000);
    await f.owner.mutation(pause, { paused: true });
    expect(await preferences()).toEqual([
      expect.objectContaining({ ninaMemoryPaused: true, updatedAt: 1000 }),
    ]);
    const paused = await f.owner.query(list, {});
    expect(paused).toMatchObject({
      memories: [{ inUse: false, text: "Kept" }],
      paused: true,
    });
    expect(await f.t.query(read, { userId: f.identity.userId })).toMatchObject({
      known: [],
      paused: true,
      prompt: [],
    });
    expect(await f.stored()).toHaveLength(1);
    await f.owner.mutation(pause, { paused: false });
    const [resumed] = await preferences();
    expect(resumed?.ninaMemoryPaused).toBeUndefined();
    expect(resumed?.updatedAt).toBe(2000);
    expect(await f.owner.query(list, {})).toMatchObject({
      memories: [{ inUse: true }],
      paused: false,
    });
    expect(
      prompted(await f.t.query(read, { userId: f.identity.userId }))
    ).toEqual(["Kept"]);
  });

  it("keeps the learner's other preferences when it pauses and resumes", async () => {
    const f = await createMemoryTest();
    await f.t.mutation((ctx) =>
      ctx.db.insert("learningPreferences", {
        preferredTryoutCountryKey: "indonesia",
        updatedAt: 1,
        userId: f.identity.userId,
      })
    );
    await f.owner.mutation(pause, { paused: true });
    await f.owner.mutation(pause, { paused: false });
    expect(
      await f.t.query((ctx) => ctx.db.query("learningPreferences").collect())
    ).toEqual([
      expect.objectContaining({ preferredTryoutCountryKey: "indonesia" }),
    ]);
  });
});

describe("Nina memory expiry", () => {
  it("deletes the situations whose end date has passed, and nothing else", async () => {
    const f = await createMemoryTest();
    await f.seed({ kind: "situation", text: "Ended", validUntil: NOW - 1 });
    await f.seed({ kind: "situation", text: "Today", validUntil: NOW + 1 });
    await f.seed({ author: "learner", text: "Open-ended" });
    await f.seed({ kind: "goal", text: "A goal" });
    expect(await f.t.mutation(expire, {})).toBe(1);
    expect(await f.texts()).toEqual(["Today", "Open-ended", "A goal"]);
    expect(await f.t.mutation(expire, {})).toBe(0);
  });

  it("goes on with the next page by itself while a page is full", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    for (const userId of [f.identity.userId, other.userId]) {
      await f.fill(EXPIRY_PAGE / 2 + 1, {
        kind: "situation",
        userId,
        validUntil: NOW - 1,
      });
    }
    await f.seed({ kind: "situation", text: "Later", validUntil: NOW + 1 });
    expect(await f.t.mutation(expire, {})).toBe(EXPIRY_PAGE);
    expect(await f.stored()).toHaveLength(3);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual(["Later"]);
    expect(await f.stored()).toHaveLength(1);
  });
});
