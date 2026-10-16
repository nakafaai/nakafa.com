import { RegisteredFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import { NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import { HISTORY_TURNS } from "@repo/backend/confect/nina/fold";
import {
  type NinaUncoveredTurn,
  SUMMARY_FOLD_LIMIT,
} from "@repo/backend/confect/nina/summaries.spec";
import {
  readUncovered,
  turnMessages,
} from "@repo/backend/confect/nina/uncovered";
import { provider } from "@repo/backend/test/gateway";
import { createNinaTest } from "@repo/backend/test/nina";
import {
  BIG,
  createSummaryTest,
  EARLIER,
  EARLIER_THROUGH,
  EARLIER_USAGE,
  expectEarlier,
  readsOf,
  summaryModel,
} from "@repo/backend/test/nina/summary";
import { Array as Arr, Effect, Option, Predicate } from "effect";

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

/**
 * Reads the turns before the fixture's turn, which waits at the next order,
 * and counts the queries the read made: one per page of turns, one per page
 * of thread messages.
 */
async function read(
  nina: Awaited<ReturnType<typeof createNinaTest>>,
  later: readonly (typeof NinaUncoveredTurn.Type)[] = []
) {
  const active = await nina.t.query((ctx) =>
    ctx.db.get("ninaTurns", nina.turnId)
  );
  return nina.t.action(async (ctx) => {
    const runQuery = vi.spyOn(ctx, "runQuery");
    const result = await Effect.runPromise(
      readUncovered(nina, active?.order ?? 0, null, later).pipe(
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    );
    const queries = Arr.map(runQuery.mock.calls, ([, args]) => args);
    return {
      ...result,
      messagePages: Arr.filter(queries, (args) =>
        Predicate.hasProperty(args, "paginationOpts")
      ).length,
      turnPages: Arr.filter(queries, (args) =>
        Predicate.hasProperty(args, "before")
      ).length,
    };
  });
}

describe("Nina turns after the summary", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads more turns than one page holds, oldest first, with the messages the model would receive", async () => {
    const f = await createNinaTest({
      history: Arr.makeBy(2 * SUMMARY_FOLD_LIMIT + 4, () => ({})),
    });
    const { docs, turns, turnPages, unread } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual(
      Arr.range(0, 2 * SUMMARY_FOLD_LIMIT + 3)
    );
    expect(turns[0]?.messages).toMatchObject([
      { role: "user", content: "Earlier question 0" },
      { role: "assistant", content: "Earlier answer 0" },
    ]);
    expect(turns[0]?.tokens).toBeGreaterThan(0);
    // Two full pages and a short one, which shows the turns have run out.
    expect(turnPages).toBe(3);
    expect(unread).toEqual(Option.none());
    // The turn that waits is among the messages read too.
    expect(turnMessages(docs, 2 * SUMMARY_FOLD_LIMIT + 4)[0]?.role).toBe(
      "user"
    );
  }, 15_000);

  it("stops after the page that brings the turns past the history budget, and reads no thread page it does not need", async () => {
    // Forty turns of 3,000 tokens: the newest sixteen already cost 48,000.
    const f = await createNinaTest({
      history: Arr.makeBy(40, () => ({ tokens: 3000 })),
    });
    const { messagePages, turns, turnPages, unread } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual(Arr.range(24, 39));
    expect(
      Arr.reduce(turns, 0, (total, { tokens }) => total + tokens)
    ).toBeGreaterThan(NINA_BUDGET.history);
    expect(turnPages).toBe(1);
    // About 36 messages hold the sixteen turns, where the whole chat needs two pages.
    expect(messagePages).toBe(1);
    // The turns before order 24 were never listed.
    expect(unread).toEqual(Option.some(23));
  }, 15_000);

  it("names no unread turn when the page that brings the turns past the history budget reaches the oldest one", async () => {
    // Sixteen turns of 3,000 tokens are exactly one page, and they cost 48,000.
    const f = await createNinaTest({
      history: Arr.makeBy(SUMMARY_FOLD_LIMIT, () => ({ tokens: 3000 })),
    });
    const { turns, turnPages, unread } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual(
      Arr.range(0, SUMMARY_FOLD_LIMIT - 1)
    );
    expect(turnPages).toBe(1);
    expect(unread).toEqual(Option.none());
  });

  it("goes on while the turns fit the history budget, however many pages that takes", async () => {
    const f = await createNinaTest({
      history: Arr.makeBy(40, () => ({ tokens: 500 })),
    });
    const { turns, turnPages } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual(Arr.range(0, 39));
    expect(turnPages).toBe(3);
  }, 15_000);

  it("stops at the most turns the history takes, though they fit the budget, and names the turns it left out", async () => {
    const f = await createNinaTest({
      history: Arr.makeBy(HISTORY_TURNS + 6, () => ({})),
    });
    const { turns, turnPages, unread } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual(
      Arr.range(6, HISTORY_TURNS + 5)
    );
    expect(turnPages).toBe(HISTORY_TURNS / SUMMARY_FOLD_LIMIT);
    expect(unread).toEqual(Option.some(5));
  }, 30_000);

  it("takes only the newest turns of the page that reaches the most turns, when every page lost a replaced asking", async () => {
    // Orders 19, 35, 51, 67 and 83 each ask the question before them again, so
    // every page of 16 rows keeps 15 turns. Four pages give 60 turns, and the
    // fifth holds 15 more: the history takes its newest 4.
    const f = await createNinaTest({
      history: Arr.makeBy(85, (order) =>
        order % SUMMARY_FOLD_LIMIT === 3 && order > 3
          ? { retryOf: order - 1 }
          : {}
      ),
    });
    const { turns, turnPages, unread } = await read(f);
    expect(turns).toHaveLength(HISTORY_TURNS);
    expect(Arr.map(turns, ({ order }) => order)).toEqual(
      Arr.filter(
        Arr.range(16, 84),
        (order) => order % SUMMARY_FOLD_LIMIT !== 2 || order === 2
      )
    );
    expect(turnPages).toBe(5);
    expect(unread).toEqual(Option.some(15));
  }, 30_000);

  it("goes on past a page of retries of one huge turn to the older turn that a fold would take", async () => {
    // Order 16 retries a question 15 times over and costs more than the whole budget.
    // The first page holds it and the 15 askings it replaced, and order 0 waits behind.
    const f = await createNinaTest({
      history: Arr.makeBy(17, (order) => {
        if (order === 16) {
          return { retryOf: 1, tokens: NINA_BUDGET.history + 1000 };
        }
        return order >= 2 ? { retryOf: 1 } : {};
      }),
    });
    const { turns, turnPages } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual([0, 16]);
    expect(turnPages).toBe(2);
  }, 15_000);

  it("gives up once it has passed 32 replaced askings and names the turns behind them, instead of reading the whole chat", async () => {
    // Order 10 asks a question and 69 retries ask it again, so only the last is kept.
    const f = await createNinaTest({
      history: Arr.makeBy(80, (order) => (order > 10 ? { retryOf: 10 } : {})),
    });
    const { messagePages, turns, turnPages, unread } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual([79]);
    // Three pages pass 15, 31 and then 47 replaced askings. The chat holds 80 turns and 161 messages.
    expect(turnPages).toBe(3);
    expect(messagePages).toBe(2);
    expect(unread).toEqual(Option.some(31));
  }, 15_000);

  it("keeps the newest asking of a question that a later page asks again", async () => {
    // Order 18 asks the question of order 2 again, and order 2 is on the second page.
    const f = await createNinaTest({
      history: Arr.makeBy(20, (order) => (order === 18 ? { retryOf: 2 } : {})),
    });
    const { turns } = await read(f);
    expect(Arr.map(turns, ({ order }) => order)).toEqual(
      Arr.filter(Arr.range(0, 19), (order) => order !== 2)
    );
  });

  it("hides the earlier askings of the question a later turn asks again", async () => {
    const f = await createNinaTest({ history: 6 });
    const { turns } = await read(f, [{ order: 6, retryOf: 3 }]);
    expect(Arr.map(turns, ({ order }) => order)).toEqual([0, 1, 2, 4, 5]);
  });
});

describe("Nina fold wait from the cost its prompt stored", () => {
  /** Whether a query of a refresh asks for the turns that a summary does not cover. */
  const asksTurns = (args: unknown) => Predicate.hasProperty(args, "through");

  it.each([
    [
      "the turn that settled outweighs the budget with its history",
      // Four turns of 7,000 tokens fit the budget of 32,000, and a fifth of 6,000 does not.
      5,
      (order: number) => ({ tokens: order === 4 ? 6000 : 7000 }),
    ],
    [
      "the read behind the cost left the oldest turns out",
      // The read of forty turns of 1,000 tokens stops after the page that outweighs the budget.
      40,
      () => ({ tokens: 1000 }),
    ],
  ])(
    "reads the turns and folds as it does without the cost when %s",
    async (_case, turns, shape) => {
      provider.languageModel.mockReturnValue(summaryModel("- A fold."));
      const settled = turns - 1;
      const stored = await createSummaryTest(turns, shape);
      const history = await stored.history(settled);
      const full = await createSummaryTest(turns, shape);
      await full.refresh(settled);
      const refreshed = await stored.measure(settled, { history });
      const throughs = async (f: typeof stored) =>
        Arr.map(await f.summary(), ({ throughOrder }) => throughOrder);
      expect(await throughs(full)).toHaveLength(1);
      expect(await throughs(stored)).toEqual(await throughs(full));
      expect(Arr.some(refreshed.queries, asksTurns)).toBe(true);
    },
    30_000
  );

  it("folds at the same turns as the full read after every turn of a chat, and reads the turns for only some of them", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- A study session."));
    // Each turn costs about 9,000 tokens: a fold comes every four or so.
    const shape = () => ({ tokens: 9000 });
    const full = await createSummaryTest(14, shape);
    const stored = await createSummaryTest(14, shape);
    let reads: readonly boolean[] = [];
    for (const settled of Arr.range(0, 12)) {
      await full.refresh(settled);
      const { queries } = await stored.measure(settled, {
        history: await stored.history(settled),
      });
      reads = Arr.append(reads, Arr.some(queries, asksTurns));
      expect((await stored.stored())?.throughOrder).toBe(
        (await full.stored())?.throughOrder
      );
      expect(await stored.lost(settled)).toEqual([]);
    }
    // The summary folded more than once, and the turns that fit never read the chat.
    expect((await stored.stored())?.throughOrder).toBeGreaterThan(2);
    expect(Arr.filter(reads, (read) => !read).length).toBeGreaterThan(3);
    expect(Arr.filter(reads, (read) => read).length).toBeGreaterThan(1);
  }, 60_000);

  it("keeps the previous summary when the thread cannot be read, though the turn stored what its history cost", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(9, () => BIG);
    await f.seed(EARLIER_THROUGH, EARLIER);
    await f.refresh(8, {
      history: { tokens: 100, turns: 2 },
      threadId: "missing-thread",
    });
    await expectEarlier(f);
  });

  it("reads the turns when the turn that settled holds no question and answer in the thread, though it stored what its history cost", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    // A cancelled turn leaves its prompt failed, so the thread holds no whole turn of it.
    const f = await createSummaryTest(3, (order) =>
      order === 2 ? { cancelled: true } : {}
    );
    const { queries } = await f.measure(2, {
      history: { tokens: 100, turns: 2 },
    });
    const reads = readsOf(queries);
    // Its own page came first, then the read of the turns, which fit the budget.
    expect(reads.pages[0]).toMatchObject({
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(reads.uncovered).toHaveLength(1);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
  });

  it("reads the turn that settled and nothing else while it and the history of its prompt fit the budget", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    // Twenty turns of about 500 tokens came before the one that settled.
    const f = await createSummaryTest(21, () => ({ tokens: 500 }));
    const history = await f.history(20);
    expect(history).toEqual({ tokens: expect.any(Number), turns: 20 });
    const full = await f.measure(20);
    const own = await f.measure(20, { history });
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
    // Without the cost the refresh pages through the turns and their messages.
    expect(readsOf(full.queries).uncovered).toHaveLength(2);
    expect(full.read.documentsRead).toBe(64);
    // With it the refresh reads one page of ten messages from the prompt of
    // the turn, which holds the turn and the turn before it, and not even the
    // summary row.
    expect(own.queries).toEqual([
      expect.objectContaining({
        paginationOpts: { cursor: null, numItems: 10 },
        upToAndIncludingMessageId: f.prompts[20],
      }),
    ]);
    expect(own.read.documentsRead).toBe(11);
    expect(own.read.bytesRead).toBeLessThan(full.read.bytesRead / 3);
  });

  it("waits on a stored cost that counts turns a fold has covered since, because the turns that remain cost no more", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(21, () => ({ tokens: 500 }));
    // The prompt of the last turn was built before a fold covered orders 0 to 9.
    const history = await f.history(20);
    await f.seed(9, EARLIER);
    const { queries } = await f.measure(20, { history });
    expect(queries).toHaveLength(1);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 9, usage: EARLIER_USAGE }),
    ]);
  });

  it("reads the turns once the history holds as many as it takes, because the count of turns decides a fold too", async () => {
    provider.languageModel.mockReturnValue(
      summaryModel("- The first sixteen turns.")
    );
    const f = await createSummaryTest(HISTORY_TURNS + 3);
    // Sixty-three short turns came before the sixty-fourth, which leaves no room for another.
    const last = HISTORY_TURNS - 1;
    const history = await f.history(last);
    expect(history).toEqual({ tokens: expect.any(Number), turns: last });
    const fits = await f.measure(last, { history });
    expect(readsOf(fits.queries).uncovered).not.toHaveLength(0);
    expect(provider.languageModel).not.toHaveBeenCalled();
    // The sixty-fifth is one too many, and the fold covers the oldest batch, as it does without the cost.
    await f.refresh(HISTORY_TURNS, { history: await f.history(HISTORY_TURNS) });
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: SUMMARY_FOLD_LIMIT - 1 }),
    ]);
  }, 60_000);
});
