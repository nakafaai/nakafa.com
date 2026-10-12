import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { MEMORY_BATCH } from "@repo/backend/confect/nina/memory/store";
import {
  createMemoryTest,
  sessionRequired,
} from "@repo/backend/test/nina/memory";

const memory = refs.public.nina.memory;
const get = Ref.getFunctionReference(memory.get);
const enable = Ref.getFunctionReference(memory.enable);
const disable = Ref.getFunctionReference(memory.disable);
const forget = Ref.getFunctionReference(memory.forget);
const state = Ref.getFunctionReference(memory.state);
const list = Ref.getFunctionReference(memory.list);
const pause = Ref.getFunctionReference(memory.pause);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("the settings card of a browser tab opened before October 2026", () => {
  it("shows memory as it is: on with no fact, off once paused, and nothing to a visitor", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Not a fact of the old card" });
    expect(await f.t.query(get, {})).toBeNull();
    expect(await f.owner.query(get, {})).toEqual({ facts: [] });
    await f.owner.mutation(pause, { paused: true });
    expect(await f.owner.query(get, {})).toBeNull();
  });

  it("turns memory off and deletes every memory of that learner with its keys, as its button says", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Mine" });
    await f.seed({ author: "learner", text: "Also mine" });
    await f.seed({ text: "Theirs", userId: other.userId });
    expect(await f.owner.mutation(disable, {})).toBeNull();
    expect(await f.owner.query(get, {})).toBeNull();
    expect(await f.owner.query(state, {})).toEqual({ paused: true });
    expect(await f.texts()).toEqual([]);
    expect(await f.texts(other.userId)).toEqual(["Theirs"]);
    expect(await f.keys()).toEqual([
      expect.objectContaining({ userId: other.userId }),
    ]);
    expect(await other.owner.query(get, {})).toEqual({ facts: [] });
  });

  it("deletes the memories in batches, as the clear of the Memory page does, and hides them at once", async () => {
    const f = await createMemoryTest();
    await f.fill(MEMORY_BATCH + 10);
    expect(await f.owner.mutation(disable, {})).toBeNull();
    // One batch at once, and the rest by itself.
    expect(await f.stored()).toHaveLength(10);
    // The ten that wait for the batches are listed nowhere.
    expect(
      await f.owner.query(list, {
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).toMatchObject({ isDone: true, page: [] });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.stored()).toEqual([]);
    expect(await f.keys()).toEqual([]);
  });

  it("turns memory on again", async () => {
    const f = await createMemoryTest();
    await f.owner.mutation(pause, { paused: true });
    expect(await f.owner.mutation(enable, {})).toEqual({ facts: [] });
    expect(await f.owner.query(get, {})).toEqual({ facts: [] });
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
  });

  it("has no fact to forget, so forgetting changes nothing", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Stays as it is" });
    const before = await f.stored();
    expect(await f.owner.mutation(forget, { key: 0 })).toBeNull();
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(before);
  });

  it("refuses a visitor who presses its buttons with the typed failure, and changes nothing", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Stays as it is" });
    const stored = await f.stored();
    const keys = await f.keys();
    for (const press of [
      () => f.t.mutation(enable, {}),
      () => f.t.mutation(disable, {}),
      () => f.t.mutation(forget, { key: 0 }),
    ]) {
      await expect(press()).rejects.toMatchObject(sessionRequired);
    }
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(stored);
    expect(await f.keys()).toStrictEqual(keys);
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
  });
});
