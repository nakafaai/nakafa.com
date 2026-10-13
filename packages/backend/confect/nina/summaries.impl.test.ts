import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";
import { showsText } from "@repo/backend/test/seal";
import { Array as Arr } from "effect";

const read = Ref.getFunctionReference(refs.internal.nina.summaries.read);
const save = Ref.getFunctionReference(refs.internal.nina.summaries.save);
const uncovered = Ref.getFunctionReference(
  refs.internal.nina.summaries.uncovered
);
const asked = Ref.getFunctionReference(refs.internal.nina.summaries.asked);
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

  it("counts the usage of a refresh that sends no text, and changes nothing else", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation(save, {
      chatId,
      text: "- Kept.",
      throughOrder: 7,
      usage: call,
    });
    await t.mutation(save, { chatId, throughOrder: 11, usage: call });
    expect(await t.query(read, { chatId })).toEqual({
      text: "- Kept.",
      throughOrder: 7,
    });
    expect(
      await t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toEqual([
      expect.objectContaining({
        throughOrder: 7,
        usage: { calls: 2, input: 1800, output: 240 },
      }),
    ]);
  });

  it("creates no summary for a refresh that sends no text, because a summary holds text", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation(save, { chatId, throughOrder: 3, usage: call });
    expect(await t.query(read, { chatId })).toBeNull();
    expect(
      await t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toEqual([]);
  });

  it("stores the text sealed, so a table export shows no text, and reads it back as text", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation(save, {
      chatId,
      text: "- Sealed row about limits.",
      throughOrder: 7,
      usage: call,
    });
    const [row] = await t.query((ctx) =>
      ctx.db.query("ninaSummaries").collect()
    );
    expect(row?.text).toBeInstanceOf(ArrayBuffer);
    expect(showsText(row?.text, "- Sealed row about limits.")).toBe(false);
    expect(await t.query(read, { chatId })).toEqual({
      text: "- Sealed row about limits.",
      throughOrder: 7,
    });
  });

  it("reads as none when the chat of a summary is gone", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation(save, {
      chatId,
      text: "- Soon orphaned.",
      throughOrder: 3,
      usage: call,
    });
    await t.mutation((ctx) => ctx.db.delete("chats", chatId));
    expect(await t.query(read, { chatId })).toBeNull();
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
  it("lists the complete ones, newest first, with the turn that first asked the question of a retry", async () => {
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

  it("lists the newest complete turn that asked each question again, and no other", async () => {
    const { t, chatId } = await createNinaTest({
      history: [
        {},
        {},
        { retryOf: 0 },
        { cancelled: true, retryOf: 0 },
        { retryOf: 1 },
        { retryOf: 0 },
      ],
    });
    // The cancelled retry is no answer, and order 5 is not before 5.
    expect(
      await t.query(asked, { before: 5, chatId, questions: [0, 1] })
    ).toEqual([
      { order: 2, retryOf: 0 },
      { order: 4, retryOf: 1 },
    ]);
    // One question, one turn: the newest complete asking stands for the rest.
    expect(await t.query(asked, { before: 6, chatId, questions: [0] })).toEqual(
      [{ order: 5, retryOf: 0 }]
    );
    // A question nobody asked again, and no question at all.
    expect(await t.query(asked, { before: 6, chatId, questions: [4] })).toEqual(
      []
    );
    expect(await t.query(asked, { before: 6, chatId, questions: [] })).toEqual(
      []
    );
  });

  it("finds a complete retry behind any number of stopped ones", async () => {
    const { t, chatId } = await createNinaTest({
      history: [
        {},
        { retryOf: 0 },
        ...Arr.makeBy(20, () => ({ cancelled: true, retryOf: 0 })),
      ],
    });
    expect(
      await t.query(asked, { before: 22, chatId, questions: [0] })
    ).toEqual([{ order: 1, retryOf: 0 }]);
  });

  it("lists a complete turn behind any number of stopped ones", async () => {
    const { t, chatId } = await createNinaTest({
      history: [{}, ...Arr.makeBy(20, () => ({ cancelled: true }))],
    });
    expect(
      await t.query(uncovered, { chatId, through: null, before: 21 })
    ).toEqual([{ order: 0 }]);
  });

  it("skips a turn that is still running", async () => {
    const { t, chatId } = await createNinaTest({ history: 1 });
    // The reserved turn is active, and sits at order 1.
    expect(
      await t.query(uncovered, { chatId, through: null, before: 2 })
    ).toEqual([{ order: 0 }]);
  });

  it("lists at most the newest sixteen, one page of turns and the most one fold covers", async () => {
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
