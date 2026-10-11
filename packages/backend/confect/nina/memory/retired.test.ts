import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createMemoryTest } from "@repo/backend/test/nina/memory";

const memory = refs.public.nina.memory;
const get = Ref.getFunctionReference(memory.get);
const enable = Ref.getFunctionReference(memory.enable);
const disable = Ref.getFunctionReference(memory.disable);
const forget = Ref.getFunctionReference(memory.forget);
const list = Ref.getFunctionReference(memory.list);
const pause = Ref.getFunctionReference(memory.pause);

describe("the settings card of a browser tab opened before October 2026", () => {
  it("shows memory as it is: on with no fact, off once paused, and nothing to a visitor", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Not a fact of the old card" });
    expect(await f.t.query(get, {})).toBeNull();
    expect(await f.owner.query(get, {})).toEqual({ facts: [] });
    await f.owner.mutation(pause, { paused: true });
    expect(await f.owner.query(get, {})).toBeNull();
  });

  it("turns memory off and deletes every memory of that learner, as its button says", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Mine" });
    await f.seed({ author: "learner", text: "Also mine" });
    await f.seed({ text: "Theirs", userId: other.userId });
    expect(await f.owner.mutation(disable, {})).toBeNull();
    expect(await f.owner.query(get, {})).toBeNull();
    expect(await f.owner.query(list, {})).toEqual({
      memories: [],
      paused: true,
    });
    expect(await f.texts(other.userId)).toEqual(["Theirs"]);
    expect(await other.owner.query(get, {})).toEqual({ facts: [] });
  });

  it("turns memory on again", async () => {
    const f = await createMemoryTest();
    await f.owner.mutation(pause, { paused: true });
    expect(await f.owner.mutation(enable, {})).toEqual({ facts: [] });
    expect(await f.owner.query(get, {})).toEqual({ facts: [] });
    expect(await f.owner.query(list, {})).toMatchObject({ paused: false });
  });

  it("has no fact to forget, so forgetting changes nothing", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Stays as it is" });
    const before = await f.stored();
    expect(await f.owner.mutation(forget, { key: 0 })).toBeNull();
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(before);
  });

  it("refuses a visitor who presses its buttons", async () => {
    const f = await createMemoryTest();
    await expect(f.t.mutation(enable, {})).rejects.toThrow();
    await expect(f.t.mutation(disable, {})).rejects.toThrow();
    await expect(f.t.mutation(forget, { key: 0 })).rejects.toThrow();
  });
});
