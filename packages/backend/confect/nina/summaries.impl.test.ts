import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";

const read = Ref.getFunctionReference(refs.internal.nina.summaries.read);
const save = Ref.getFunctionReference(refs.internal.nina.summaries.save);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Nina summary storage", () => {
  it("stores, reads, and advances one summary per chat", async () => {
    const { t, chatId } = await createNinaTest();
    expect(await t.query(read, { chatId })).toBeNull();
    await t.mutation(save, { chatId, text: "- First fold.", throughOrder: 3 });
    await t.mutation(save, { chatId, text: "- Second fold.", throughOrder: 7 });
    expect(await t.query(read, { chatId })).toEqual({
      text: "- Second fold.",
      throughOrder: 7,
    });
    expect(
      await t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toHaveLength(1);
  });

  it("never lets a slower refresh replace newer coverage", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation(save, { chatId, text: "- Newer.", throughOrder: 7 });
    await t.mutation(save, { chatId, text: "- Older.", throughOrder: 3 });
    expect(await t.query(read, { chatId })).toEqual({
      text: "- Newer.",
      throughOrder: 7,
    });
  });

  it("stores nothing for a chat deleted before the refresh finished", async () => {
    const { t, chatId } = await createNinaTest();
    await t.mutation((ctx) => ctx.db.delete("chats", chatId));
    await t.mutation(save, { chatId, text: "- Orphan.", throughOrder: 3 });
    expect(
      await t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toEqual([]);
  });
});
