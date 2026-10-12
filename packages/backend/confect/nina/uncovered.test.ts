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
import { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr, Effect, Option, Predicate } from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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
