import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr } from "effect";

const read = Ref.getFunctionReference(refs.internal.nina.summaries.read);
const save = Ref.getFunctionReference(refs.internal.nina.summaries.save);
const uncovered = Ref.getFunctionReference(
  refs.internal.nina.summaries.uncovered
);
const call = { input: 900, output: 120 };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Nina summary storage", () => {
  it("stores, reads, and advances one summary per chat", async () => {
    const { t, chatId } = await createNinaTest();
    expect(await t.query(read, { chatId })).toBeNull();
    await t.mutation(save, {
      chatId,
      text: "- First fold.",
      throughOrder: 3,
      usage: call,
    });
    await t.mutation(save, {
      chatId,
      text: "- Second fold.",
      throughOrder: 7,
      usage: call,
    });
    expect(await t.query(read, { chatId })).toEqual({
      text: "- Second fold.",
      throughOrder: 7,
    });
    expect(
      await t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toEqual([
      expect.objectContaining({
        usage: { calls: 2, input: 1800, output: 240 },
      }),
    ]);
  });

  it("never lets a slower refresh replace newer coverage but counts its usage", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation(save, {
      chatId,
      text: "- Newer.",
      throughOrder: 7,
      usage: call,
    });
    await t.mutation(save, {
      chatId,
      text: "- Older.",
      throughOrder: 3,
      usage: call,
    });
    expect(await t.query(read, { chatId })).toEqual({
      text: "- Newer.",
      throughOrder: 7,
    });
    expect(
      await t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toEqual([
      expect.objectContaining({
        usage: { calls: 2, input: 1800, output: 240 },
      }),
    ]);
  });

  it("stores nothing for a chat deleted before the refresh finished", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation((ctx) => ctx.db.delete("chats", chatId));
    await t.mutation(save, {
      chatId,
      text: "- Orphan.",
      throughOrder: 3,
      usage: call,
    });
    expect(
      await t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toEqual([]);
  });
});

describe("Nina turns after the summary", () => {
  it("lists the complete ones, newest first, with the turn a retry answered again", async () => {
    // Order 1 was cancelled, and order 2 asks the question of order 0 again.
    const { t, chatId } = await createNinaTest({
      history: [{}, { cancelled: true }, { retryOf: 0 }, {}],
    });
    expect(
      await t.query(uncovered, { chatId, through: null, before: 4 })
    ).toEqual([{ order: 3 }, { order: 2, retryOf: 0 }, { order: 0 }]);
    expect(await t.query(uncovered, { chatId, through: 1, before: 4 })).toEqual(
      [{ order: 3 }, { order: 2, retryOf: 0 }]
    );
    expect(await t.query(uncovered, { chatId, through: 0, before: 3 })).toEqual(
      [{ order: 2, retryOf: 0 }]
    );
  });

  it("skips a turn that is still running", async () => {
    const { t, chatId } = await createNinaTest({ history: 1 });
    // The reserved turn is active, and sits at order 1.
    expect(
      await t.query(uncovered, { chatId, through: null, before: 2 })
    ).toEqual([{ order: 0 }]);
  });

  it("reads at most the newest sixteen, the most one summary refresh folds", async () => {
    const { t, chatId } = await createNinaTest({
      history: Arr.makeBy(18, () => ({})),
    });
    const turns = await t.query(uncovered, {
      chatId,
      through: null,
      before: 18,
    });
    expect(turns).toHaveLength(16);
    expect(turns[0]).toEqual({ order: 17 });
    expect(turns[15]).toEqual({ order: 2 });
  });
});
