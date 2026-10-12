import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { PAGE_LIMIT } from "@repo/backend/confect/nina/unanswered.spec";
import { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr } from "effect";

const settle = Ref.getFunctionReference(refs.internal.nina.unanswered.settle);

const NOW = Date.UTC(2026, 9, 12, 18);
/** When the prompts of the stored turns were saved, long before the call. */
const PROMPTED = Date.UTC(2026, 0, 12, 4);

type Nina = Awaited<ReturnType<typeof createNinaTest>>;

/**
 * A learner whose chat holds six turns in creation order: the active turn the
 * fixture queues, a complete one, and at positions 2, 3 and 5 three turns in
 * the phase `unanswered`, stored as production holds them, with a failed turn
 * between them.
 */
async function seeded() {
  const nina = await createNinaTest({ now: NOW });
  const { chatId, identity, t, threadId } = nina;
  const facts = (order: number) => ({
    chatId,
    order,
    promptMessageId: `prompt-${order}`,
    threadId,
    usage: [],
    userId: identity.userId,
  });
  const unanswered = (order: number) =>
    ({
      ...facts(order),
      phase: "unanswered",
      promptedAt: PROMPTED + order,
      state: { status: "unanswered" },
    }) as const;
  await t.mutation(async (ctx) => {
    await ctx.db.insert("ninaTurns", {
      ...facts(1),
      phase: "settled",
      state: { finishedAt: PROMPTED, status: "complete" },
    });
    await ctx.db.insert("ninaTurns", unanswered(2));
    await ctx.db.insert("ninaTurns", unanswered(3));
    await ctx.db.insert("ninaTurns", {
      ...facts(4),
      phase: "settled",
      state: { finishedAt: PROMPTED, reason: "unknown", status: "failed" },
    });
    await ctx.db.insert("ninaTurns", unanswered(5));
  });
  return nina;
}

/** Every turn, in creation order. */
function turns({ t }: Nina) {
  return t.query((ctx) => ctx.db.query("ninaTurns").collect());
}

// Every test builds a Nina fixture, which can take longer than the default limit
// while many test workers share the machine.
describe("nina/unanswered", { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ends every unanswered turn as interrupted at the time of the call, and changes nothing else", async () => {
    const nina = await seeded();
    const before = await turns(nina);
    expect(Arr.map(before, (turn) => turn.phase)).toEqual([
      "active",
      "settled",
      "unanswered",
      "unanswered",
      "settled",
      "unanswered",
    ]);

    expect(await nina.t.mutation(settle, { numItems: PAGE_LIMIT })).toEqual({
      settled: 3,
    });

    expect(await turns(nina)).toEqual(
      Arr.map(before, (turn) =>
        turn.phase === "unanswered"
          ? {
              ...turn,
              phase: "settled",
              state: {
                finishedAt: NOW,
                reason: "interrupted",
                status: "failed",
              },
            }
          : turn
      )
    );
  });

  it("ends no more turns than one call asks for, and finds none once all are ended", async () => {
    const nina = await seeded();

    expect(await nina.t.mutation(settle, { numItems: 2 })).toEqual({
      settled: 2,
    });
    expect(Arr.map(await turns(nina), (turn) => turn.phase)).toEqual([
      "active",
      "settled",
      "settled",
      "settled",
      "settled",
      "unanswered",
    ]);
    expect(await nina.t.mutation(settle, { numItems: 2 })).toEqual({
      settled: 1,
    });
    const ended = await turns(nina);

    expect(await nina.t.mutation(settle, { numItems: 2 })).toEqual({
      settled: 0,
    });
    expect(await turns(nina)).toEqual(ended);
  });

  it.each([0, PAGE_LIMIT + 1])(
    "refuses a call for %s turns and writes nothing",
    async (numItems) => {
      const nina = await seeded();
      const before = await turns(nina);
      await expect(nina.t.mutation(settle, { numItems })).rejects.toThrow();
      expect(await turns(nina)).toEqual(before);
    }
  );
});
