import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { MEMORY_BATCH } from "@repo/backend/confect/nina/memory/store";
import type { NinaLearner } from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { createPortraitTest } from "@repo/backend/test/nina/portrait";
import { Array as Arr, Order } from "effect";

const memory = refs.public.nina.memory;
const state = Ref.getFunctionReference(memory.state);
const list = Ref.getFunctionReference(memory.list);
const remove = Ref.getFunctionReference(memory.remove);
const pause = Ref.getFunctionReference(memory.pause);
const clear = Ref.getFunctionReference(memory.clear);
const add = Ref.getFunctionReference(memory.add);
const edit = Ref.getFunctionReference(memory.edit);
const read = Ref.getFunctionReference(refs.internal.nina.memory.read);
const known = Ref.getFunctionReference(refs.internal.nina.memory.known);
const drain = Ref.getFunctionReference(refs.internal.nina.memory.drain);
const expire = Ref.getFunctionReference(refs.internal.nina.memory.expire);

const NOW = Date.UTC(2026, 9, 10, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** The learners that own the stored key rows, once each. */
async function keyOwners(f: Awaited<ReturnType<typeof createMemoryTest>>) {
  return Arr.dedupe(Arr.map(await f.keys(), (row) => row.userId));
}

/** The memories that hold key rows, once each: they are the memories that are stored. */
async function keyedMemories(f: Awaited<ReturnType<typeof createMemoryTest>>) {
  return Arr.sort(
    Arr.dedupe(Arr.map(await f.keys(), (row) => row.memoryId)),
    Order.String
  );
}

/** The stored memories. */
async function storedIds(f: Awaited<ReturnType<typeof createMemoryTest>>) {
  return Arr.sort(
    Arr.map(await f.stored(), (row) => row._id),
    Order.String
  );
}

/** The words of each memory a turn tells about, in the order they are told. */
function words(notes: (typeof NinaLearner.Type)["recalled"]) {
  return Arr.map(notes, (note) => note.text);
}

/**
 * What every reader of a learner's memories returns, as the words of the
 * memories: the Memory page's list, the memories a turn recalls, the ones
 * the capture call reads, and the search they use.
 */
async function readers(f: Awaited<ReturnType<typeof createMemoryTest>>) {
  const userId = f.identity.userId;
  const page = Ref.decodeReturnsSync(
    memory.list,
    await f.owner.query(list, {
      paginationOpts: { cursor: null, numItems: 50 },
    })
  );
  const turn = await f.t.query(read, {
    now: NOW,
    said: "memory",
    topics: [],
    userId,
  });
  const capture = await f.t.query(known, {
    message: "memory",
    now: NOW,
    topics: [],
    userId,
  });
  return {
    capture: words(capture.known),
    found: await f.find({ limit: 30, text: "memory" }),
    listed: Arr.map(page.page, (item) => item.text),
    turn: words(turn.recalled),
  };
}

describe("Nina memory removal", () => {
  it("removes one memory with its keys, and ignores a memory that is gone", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ text: "Goes", topics: ["path:materials/math"] });
    await f.seed({ text: "Stays" });
    expect(await f.owner.mutation(remove, { id })).toBeNull();
    expect(await f.owner.mutation(remove, { id })).toBeNull();
    expect(await f.texts()).toEqual(["Stays"]);
    // A memory of one word has one key. The memory that went left none.
    expect(await f.keys()).toEqual([
      expect.objectContaining({ key: await f.wordKeyOf("stays") }),
    ]);
  });

  it("clears every memory of the learner with its keys and no one else's", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Mine", topics: ["path:materials/math"] });
    await f.seed({ author: "learner", text: "Also mine", title: "Titled" });
    await f.seed({ text: "Theirs", userId: other.userId });
    expect(await f.owner.mutation(clear, {})).toBeNull();
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual([]);
    expect(await f.texts(other.userId)).toEqual(["Theirs"]);
    expect(await keyOwners(f)).toEqual([other.userId]);
  });

  it("deletes the learner's portrait when it clears, before the later batches have deleted the memories it came from, and no one else's", async () => {
    const f = await createPortraitTest();
    const other = await f.stranger();
    await f.fill(MEMORY_BATCH + 5);
    await f.seed({ text: "Theirs", userId: other.userId });
    await f.seedPortrait({ text: "Mine." });
    await f.seedPortrait({ text: "Theirs.", userId: other.userId });
    expect(await f.owner.mutation(clear, {})).toBeNull();
    // Five of the learner's memories wait for the next batch, and the portrait
    // is gone already.
    expect(await f.stored()).toHaveLength(6);
    expect(Arr.map(await f.rows(), (row) => row.userId)).toEqual([
      other.userId,
    ]);
  });

  it("clears the memories a batch of 25 at a time and goes on by itself until none is left", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.fill(60);
    await f.fill(1, { userId: other.userId });
    expect(await f.owner.mutation(clear, {})).toBeNull();
    // The public function deletes one batch and returns at once, and the keys
    // of the 25 memories it deleted went with them.
    expect(await f.stored()).toHaveLength(36);
    expect(await keyedMemories(f)).toEqual(await storedIds(f));
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual([]);
    expect(await f.texts(other.userId)).toEqual(["Memory 0"]);
    expect(await f.stored()).toHaveLength(1);
    expect(await keyedMemories(f)).toEqual(await storedIds(f));
    expect(await keyOwners(f)).toEqual([other.userId]);
  });

  it("deletes one batch for each call of the drain, and says how many it deleted", async () => {
    const f = await createMemoryTest();
    await f.fill(MEMORY_BATCH + 5);
    const userId = f.identity.userId;
    const through = NOW;
    expect(await f.t.mutation(drain, { through, userId })).toBe(MEMORY_BATCH);
    expect(await f.stored()).toHaveLength(5);
    expect(await f.t.mutation(drain, { through, userId })).toBe(5);
    expect(await f.t.mutation(drain, { through, userId })).toBe(0);
    expect(await f.stored()).toEqual([]);
    expect(await f.keys()).toEqual([]);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.stored()).toEqual([]);
  });

  it("keeps a memory the learner writes while the batches of a clear still run", async () => {
    const f = await createMemoryTest();
    await f.fill(60);
    expect(await f.owner.mutation(clear, {})).toBeNull();
    expect(await f.stored()).toHaveLength(35);
    // The learner writes again a moment after asking to delete everything.
    vi.setSystemTime(NOW + 1);
    const kept = await f.owner.mutation(add, { text: "Written after" });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual(["Written after"]);
    expect(await keyedMemories(f)).toEqual([kept]);
  });

  it("confirms a memory written after Delete all later than it even when the clock has not moved, so no reader hides it and no batch takes it", async () => {
    const f = await createMemoryTest();
    await f.fill(60);
    expect(await f.owner.mutation(clear, {})).toBeNull();
    // The clock still reads the moment of the deletion.
    const kept = await f.owner.mutation(add, { text: "Written after memory" });
    const after = ["Written after memory"];
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: kept, confirmedAt: NOW + 1 })
    );
    expect(await readers(f)).toEqual({
      capture: after,
      found: after,
      listed: after,
      turn: after,
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual(after);
    expect(await keyedMemories(f)).toEqual([kept]);
  });

  it("takes a memory written after an earlier Delete all when the learner asks again and the clock has not moved", async () => {
    const f = await createMemoryTest();
    await f.fill(3);
    expect(await f.owner.mutation(clear, {})).toBeNull();
    // The clock still reads the moment of the first deletion, so this memory
    // is confirmed one millisecond after it.
    await f.owner.mutation(add, { text: "Written between" });
    expect(await f.owner.mutation(clear, {})).toBeNull();
    expect(await readers(f)).toEqual({
      capture: [],
      found: [],
      listed: [],
      turn: [],
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.stored()).toEqual([]);
  });

  it("confirms an edit after Delete all later than it when the clock has not moved, so no reader hides the edited memory", async () => {
    const f = await createMemoryTest();
    await f.fill(3);
    expect(await f.owner.mutation(clear, {})).toBeNull();
    const kept = await f.owner.mutation(add, { text: "Written after memory" });
    await f.owner.mutation(edit, { id: kept, text: "Rewritten after memory" });
    const after = ["Rewritten after memory"];
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: kept, confirmedAt: NOW + 1 })
    );
    expect(await readers(f)).toMatchObject({ listed: after, turn: after });
  });

  it("hides sixty memories from every reader the moment the learner asks, shows the memory written right after, and leaves only that one when the batches have run", async () => {
    const f = await createMemoryTest();
    await f.fill(60);
    expect(await f.owner.mutation(clear, {})).toBeNull();
    // The first batch deleted 25 memories and 35 wait for the batches, yet no
    // reader returns one of them.
    expect(await f.stored()).toHaveLength(35);
    expect(await readers(f)).toEqual({
      capture: [],
      found: [],
      listed: [],
      turn: [],
    });
    vi.setSystemTime(NOW + 1);
    const kept = await f.owner.mutation(add, { text: "Written after memory" });
    const after = ["Written after memory"];
    expect(await readers(f)).toEqual({
      capture: after,
      found: after,
      listed: after,
      turn: after,
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual(after);
    expect(await keyedMemories(f)).toEqual([kept]);
    expect(await readers(f)).toEqual({
      capture: after,
      found: after,
      listed: after,
      turn: after,
    });
  });

  it("keeps the moment of the newest request, so an older one never shows what a newer one hid", async () => {
    const f = await createMemoryTest();
    const preferences = () =>
      f.t.query((ctx) => ctx.db.query("learningPreferences").collect());
    expect(await preferences()).toEqual([]);
    await f.owner.mutation(clear, {});
    expect(await preferences()).toEqual([
      expect.objectContaining({ ninaMemoryClearedAt: NOW, updatedAt: NOW }),
    ]);
    vi.setSystemTime(NOW + 1000);
    await f.owner.mutation(clear, {});
    expect(await preferences()).toEqual([
      expect.objectContaining({
        ninaMemoryClearedAt: NOW + 1000,
        updatedAt: NOW + 1000,
      }),
    ]);
    // A request that carries an earlier time moves nothing back.
    vi.setSystemTime(NOW - 1000);
    await f.owner.mutation(clear, {});
    expect(await preferences()).toEqual([
      expect.objectContaining({ ninaMemoryClearedAt: NOW + 1000 }),
    ]);
  });

  it("marks the request on the preference row the learner already has, and keeps what that row says", async () => {
    const f = await createMemoryTest();
    await f.t.mutation((ctx) =>
      ctx.db.insert("learningPreferences", {
        preferredTryoutCountryKey: "indonesia",
        updatedAt: 1,
        userId: f.identity.userId,
      })
    );
    await f.owner.mutation(pause, { paused: true });
    await f.owner.mutation(clear, {});
    expect(
      await f.t.query((ctx) => ctx.db.query("learningPreferences").collect())
    ).toEqual([
      expect.objectContaining({
        ninaMemoryClearedAt: NOW,
        ninaMemoryPaused: true,
        preferredTryoutCountryKey: "indonesia",
      }),
    ]);
    // Resuming memory keeps the request's time.
    await f.owner.mutation(pause, { paused: false });
    const [row] = await f.t.query((ctx) =>
      ctx.db.query("learningPreferences").collect()
    );
    expect(row).toMatchObject({ ninaMemoryClearedAt: NOW });
    expect(row?.ninaMemoryPaused).toBeUndefined();
  });

  it("stops after a batch that was exactly full, when none is left", async () => {
    const f = await createMemoryTest();
    await f.fill(MEMORY_BATCH);
    expect(await f.owner.mutation(clear, {})).toBeNull();
    expect(await f.stored()).toEqual([]);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.stored()).toEqual([]);
    expect(await f.keys()).toEqual([]);
  });

  it("clears 300 memories and their keys, and leaves both tables empty", async () => {
    const f = await createMemoryTest();
    await f.fill(300, { topics: ["path:materials/math"] });
    expect(await f.stored()).toHaveLength(300);
    // Each memory has a key for its topic, for its word and for its number.
    expect(await f.keys()).toHaveLength(900);
    expect(await f.owner.mutation(clear, {})).toBeNull();
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.stored()).toEqual([]);
    expect(await f.keys()).toEqual([]);
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
    expect(await f.owner.query(state, {})).toEqual({ paused: true });
    expect(
      await f.t.query(read, {
        now: NOW,
        said: "kept",
        topics: [],
        userId: f.identity.userId,
      })
    ).toMatchObject({ paused: true, recalled: [] });
    expect(await f.stored()).toHaveLength(1);
    await f.owner.mutation(pause, { paused: false });
    const [resumed] = await preferences();
    expect(resumed?.ninaMemoryPaused).toBeUndefined();
    expect(resumed?.updatedAt).toBe(2000);
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
    expect(
      await f.t.query(read, {
        now: NOW,
        said: "kept",
        topics: [],
        userId: f.identity.userId,
      })
    ).toMatchObject({
      paused: false,
      recalled: [expect.objectContaining({ text: "Kept" })],
    });
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
  it("deletes the situations whose end date has passed with their keys, and nothing else", async () => {
    const f = await createMemoryTest();
    await f.seed({ kind: "situation", text: "Usang", validUntil: NOW - 1 });
    await f.seed({ kind: "situation", text: "Today", validUntil: NOW + 1 });
    await f.seed({ author: "learner", text: "Open-ended" });
    await f.seed({ kind: "goal", text: "A goal" });
    expect(await f.t.mutation(expire, {})).toBe(1);
    expect(await f.texts()).toEqual(["Today", "Open-ended", "A goal"]);
    // Five keys: today, open, ended, a and goal. The ended situation left its key.
    expect(await f.keys()).toHaveLength(5);
    expect(Arr.map(await f.keys(), (row) => row.key)).not.toContain(
      await f.wordKeyOf("usang")
    );
    expect(await f.t.mutation(expire, {})).toBe(0);
  });

  it("deletes the portrait of a learner whose last memory ended, and keeps the portrait of one who has another memory", async () => {
    const f = await createPortraitTest();
    const other = await f.stranger();
    for (const userId of [f.identity.userId, other.userId]) {
      await f.seed({
        kind: "situation",
        text: "Usang",
        userId,
        validUntil: NOW - 1,
      });
      await f.seedPortrait({ text: "Kelas 12.", userId });
    }
    await f.seed({ text: "Lasts", userId: other.userId });
    expect(await f.t.mutation(expire, {})).toBe(2);
    expect(Arr.map(await f.rows(), (row) => row.userId)).toEqual([
      other.userId,
    ]);
  });

  it("goes on with the next batch by itself while a batch is full", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    for (const userId of [f.identity.userId, other.userId]) {
      await f.fill(Math.floor(MEMORY_BATCH / 2) + 1, {
        kind: "situation",
        userId,
        validUntil: NOW - 1,
      });
    }
    await f.seed({ kind: "situation", text: "Later", validUntil: NOW + 1 });
    expect(await f.t.mutation(expire, {})).toBe(MEMORY_BATCH);
    // 26 ended situations and one that goes on: one ended situation is left.
    expect(await f.stored()).toHaveLength(2);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual(["Later"]);
    expect(await f.stored()).toHaveLength(1);
    expect(await f.keys()).toEqual([
      expect.objectContaining({ key: await f.wordKeyOf("later") }),
    ]);
  });
});
