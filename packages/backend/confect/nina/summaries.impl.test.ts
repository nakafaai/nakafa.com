import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";
import { showsText } from "@repo/backend/test/seal";

const read = Ref.getFunctionReference(refs.internal.nina.summaries.read);
const save = Ref.getFunctionReference(refs.internal.nina.summaries.save);
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

  it("stores the text sealed and reads a plain and a sealed row back as text", async () => {
    const { t, chatId } = await createNinaTest();
    const stored = () =>
      t.query((ctx) => ctx.db.query("ninaSummaries").collect());
    // A summary written before October 2026 holds its text as a string.
    await t.mutation((ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId,
        text: "- Plain row.",
        throughOrder: 3,
        updatedAt: Date.UTC(2026, 8, 1),
        usage: { calls: 1, ...call },
      })
    );
    expect(await t.query(read, { chatId })).toEqual({
      text: "- Plain row.",
      throughOrder: 3,
    });
    await t.mutation(save, {
      chatId,
      text: "- Sealed row about limits.",
      throughOrder: 7,
      usage: call,
    });
    const [row] = await stored();
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
