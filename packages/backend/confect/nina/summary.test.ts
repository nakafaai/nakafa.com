import { createThread, saveMessage } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import { sentTurn } from "@repo/backend/confect/nina/history";
import { provider } from "@repo/backend/test/gateway";
import {
  createSummaryTest,
  failingModel,
  summaryModel,
} from "@repo/backend/test/nina/summary";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Predicate } from "effect";

/** A turn whose answer costs about 6,000 tokens, so six of them outweigh the history budget. */
const BIG = { tokens: 6000 } as const;
/** The summary that a failed fold must leave as it was, covering the turns through order 1. */
const EARLIER = "- Earlier study.";
const EARLIER_THROUGH = 1;

type SummaryTest = Awaited<ReturnType<typeof createSummaryTest>>;

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

/** Sorts the queries of a refresh by what they read, from the shape of their arguments. */
function readsOf(queries: readonly unknown[]) {
  const having = (key: string) =>
    Arr.filter(queries, (args) => Predicate.hasProperty(args, key));
  const pages = having("paginationOpts");
  return {
    anchors: Arr.filter(
      having("order"),
      (args) =>
        Predicate.hasProperty(args, "order") && Predicate.isNumber(args.order)
    ),
    asked: having("questions"),
    pages,
    uncovered: having("through"),
    window: Arr.filter(
      pages,
      (args) =>
        Predicate.hasProperty(args, "excludeToolMessages") &&
        args.excludeToolMessages === true
    ),
  };
}

/** The summary stays as `seed` stored it: its text, what it covers, and what it cost. */
async function expectEarlier(f: SummaryTest) {
  expect(await f.text()).toBe(EARLIER);
  expect(await f.summary()).toEqual([
    expect.objectContaining({
      throughOrder: EARLIER_THROUGH,
      usage: { calls: 1, input: 900, output: 120 },
    }),
  ]);
}

describe("Nina rolling summary", () => {
  it("keeps the previous summary when the fold fails, and the next model input stays inside the history budget", async () => {
    provider.languageModel.mockReturnValue(failingModel());
    // The summary covers orders 0 and 1. The four turns after it cost 48,000, more than
    // the budget, so a fold is due, and it fails.
    const f = await createSummaryTest(7, () => ({ tokens: 12_000 }));
    await f.seed(EARLIER_THROUGH, EARLIER);
    await f.refresh(5);
    await expectEarlier(f);
    const shown = await f.input(6);
    expect(sentTurn(Arr.dropRight(shown, 2)).tokens).toBeLessThanOrEqual(
      NINA_BUDGET.history
    );
    // The oldest turns that no longer fit leave this input, and the newest stay.
    expect(encodeJsonText(shown)).not.toContain('"Question 3"');
    expect(encodeJsonText(shown)).toContain('"Question 4"');
    expect(encodeJsonText(shown)).toContain('"Question 5"');
  }, 15_000);

  it("records the fold's model call in the ledger of the turn that settled, as the summary agent, and keeps no total on the summary row", async () => {
    provider.languageModel.mockReturnValue(
      summaryModel("- The learner studied limits.")
    );
    const f = await createSummaryTest(9, () => BIG);
    await f.refresh(8);
    const settled = await f.turn(8);
    expect(settled?.usage).toEqual([
      expect.objectContaining({
        agent: "summary",
        calls: 1,
        input: 12,
        output: 4,
      }),
    ]);
    // The turn is settled, so its token totals follow its ledger.
    expect(settled?.tokens).toEqual({ input: 12, output: 4, total: 16 });
    const rows = await f.summary();
    expect(rows).toEqual([expect.objectContaining({ throughOrder: 6 })]);
    // The fold's tokens go to the ledger of its turn, so the row keeps no total.
    expect(rows[0]).not.toHaveProperty("usage");
  });

  it("folds a question the learner asked again once, in its newest asking, and leaves out a cancelled turn", async () => {
    const model = summaryModel("- A tidy fold.");
    provider.languageModel.mockReturnValue(model);
    // Order 2 was cancelled after it wrote some text, and order 3 asks the question of order 1 again.
    const f = await createSummaryTest(9, (order) => {
      if (order === 2) {
        return { ...BIG, cancelled: true };
      }
      return order === 3 ? { ...BIG, retryOf: 1 } : BIG;
    });
    await f.refresh(8);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Learner: Question 0");
    expect(prompt).toContain("Nina: Answer 6");
    expect(prompt.split("Learner: Question 1")).toHaveLength(2);
    expect(prompt).toContain("Nina: Answer 3");
    expect(prompt).not.toContain("Nina: Answer 1");
    expect(prompt).not.toContain("Answer 2");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 6 }),
    ]);
  });

  it("leaves a turn out of the fold when a later turn asks its question again", async () => {
    const model = summaryModel("- A tidy fold.");
    provider.languageModel.mockReturnValue(model);
    // Order 6 stays word for word and asks the question of order 2 again.
    const f = await createSummaryTest(9, (order) =>
      order === 6 ? { retryOf: 2, tokens: 5000 } : { tokens: 5000 }
    );
    await f.refresh(8);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Learner: Question 1");
    expect(prompt).toContain("Nina: Answer 5");
    expect(prompt).not.toContain("Question 2");
    expect(prompt).not.toContain("Answer 2");
    expect(prompt).not.toContain("Answer 6");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 5 }),
    ]);
  });

  it("leaves out an answer that a retry far ahead of a long backlog replaced", async () => {
    const model = summaryModel("- The first batch of a long chat.");
    provider.languageModel.mockReturnValue(model);
    // A chat of 56 turns that has no summary yet folds orders 0 to 15 first.
    // Order 20 asks the question of order 5 again, 35 turns before the newest.
    const f = await createSummaryTest(56, (order) =>
      order === 20 ? { retryOf: 5, tokens: 2500 } : { tokens: 2500 }
    );
    await f.refresh(55);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Nina: Answer 4");
    expect(prompt).toContain("Nina: Answer 15");
    // No other folded turn holds these words: orders 50 to 55 are not folded.
    expect(prompt).not.toContain("Answer 5");
    expect(prompt).not.toContain("Question 5");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 15 }),
    ]);
  }, 15_000);

  it("extends an existing summary with the next folded turns", async () => {
    const model = summaryModel("- Limits, then derivatives.");
    provider.languageModel.mockReturnValue(model);
    const f = await createSummaryTest(13, () => ({ tokens: 4500 }));
    await f.seed(4, "- The learner studied limits.");
    await f.refresh(12);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        text: expect.any(ArrayBuffer),
        throughOrder: 9,
        // The total that the older row holds stays as it was: a refresh adds none.
        usage: { calls: 1, input: 900, output: 120 },
      }),
    ]);
    expect(await f.text()).toBe("- Limits, then derivatives.");
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("- The learner studied limits.");
    expect(prompt).toContain("Question 5");
    expect(prompt).not.toContain("Question 4");
    expect(prompt).not.toContain("Question 10");
  });

  it("reads nothing again for a fold when the read of the uncovered turns reached the oldest of them", async () => {
    const model = summaryModel("- The learner studied limits.");
    provider.languageModel.mockReturnValue(model);
    // Four turns of 11,000 tokens cost 44,000, and one page lists all of them.
    const f = await createSummaryTest(5, () => ({ tokens: 11_000 }));
    const reads = readsOf(await f.refresh(3));
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 2 }),
    ]);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Learner: Question 0");
    expect(prompt).toContain("Nina: Answer 2");
    expect(prompt).not.toContain("Question 3");
    // One page of turns and one page of messages decided the fold and fed it.
    expect(reads.uncovered).toHaveLength(1);
    expect(reads.pages).toHaveLength(1);
    expect(reads.anchors).toEqual([]);
    expect(reads.asked).toEqual([]);
    expect(reads.window).toEqual([]);
  });

  it("leaves out the tool steps of the folded turns, as before", async () => {
    const model = summaryModel("- Tool steps stay out.");
    provider.languageModel.mockReturnValue(model);
    const f = await createSummaryTest(5, (order) =>
      order < 4 ? { steps: 1, tokens: 11_000 } : {}
    );
    await f.refresh(3);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Learner: Question 0");
    expect(prompt).toContain("Nina: Answer 2");
    expect(prompt).not.toContain("Let me look it up");
    expect(prompt).not.toContain("Verified evidence");
  });

  it("folds a long backlog one bounded batch per refresh, paging to its oldest turns", async () => {
    const model = summaryModel("- A long study session.");
    provider.languageModel.mockReturnValue(model);
    const f = await createSummaryTest(56, () => ({ tokens: 2500 }));
    await f.refresh(55);
    await f.refresh(55);
    const [first, second] = Arr.map(model.doGenerateCalls, (call) =>
      encodeJsonText(call.prompt)
    );
    expect(first).toContain("Question 0");
    expect(first).toContain("Answer 15");
    expect(first).not.toContain("Question 16");
    expect(second).toContain("- A long study session.");
    expect(second).toContain("Question 16");
    expect(second).toContain("Answer 31");
    expect(second).not.toContain("Question 32");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 31 }),
    ]);
  }, 15_000);

  it("folds the oldest turns when a long run of replaced askings hides them, though the newest turns fit", async () => {
    const model = summaryModel("- The first questions.");
    provider.languageModel.mockReturnValue(model);
    // Order 10 asks a question and the 69 turns after it ask it again, so only order 79 is kept.
    const f = await createSummaryTest(80, (order) =>
      order > 10 ? { retryOf: 10 } : {}
    );
    await f.refresh(79);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    for (const order of Arr.range(0, 9)) {
      expect(prompt).toContain(`Learner: Question ${order}`);
    }
    // Orders 10 to 15 are replaced askings, and the fold covers one batch of 16.
    expect(prompt).not.toContain("Question 10");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 15 }),
    ]);
  }, 15_000);

  it.each([
    ["the provider fails", failingModel()],
    ["the answer is empty", summaryModel("   ")],
    ["the answer is cut at the output cap", summaryModel("- Cut", "length")],
  ])("keeps the previous summary when %s", async (_failure, model) => {
    provider.languageModel.mockReturnValue(model);
    const f = await createSummaryTest(9, () => BIG);
    await f.seed(EARLIER_THROUGH, EARLIER);
    await f.refresh(8);
    await expectEarlier(f);
  });

  it("reads back only from the prompt of the last folded turn", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- Folded."));
    const f = await createSummaryTest(56, () => ({ tokens: 2500 }));
    const reads = readsOf(await f.refresh(55));
    // The transcript read leaves tool messages out, unlike the read of the turns that decides the fold.
    expect(
      Arr.map(reads.window, (args) =>
        Predicate.hasProperty(args, "upToAndIncludingMessageId")
          ? String(args.upToAndIncludingMessageId)
          : ""
      )
    ).toEqual([f.prompts[15]]);
  }, 15_000);

  it("stops reading back once it reaches turns the summary covers", async () => {
    const model = summaryModel("- Later study.");
    provider.languageModel.mockReturnValue(model);
    const f = await createSummaryTest(62, () => ({ tokens: 2500 }));
    await f.seed(40, "- Earlier study.");
    const reads = readsOf(await f.refresh(61));
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Question 41");
    expect(prompt).toContain("Answer 55");
    expect(prompt).not.toContain("Question 40");
    expect(prompt).not.toContain("Question 56");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 55 }),
    ]);
    // The 112 messages up to order 55 need two pages of 100, and the first reaches order 40.
    expect(reads.window).toHaveLength(1);
  }, 15_000);

  it("keeps the previous summary when the last folded turn is missing", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(56, () => ({ tokens: 2500 }));
    await f.seed(EARLIER_THROUGH, EARLIER);
    await f.t.mutation(async (ctx) => {
      // The summary covers order 1, so a fold covers orders 2 to 17 first.
      const turn = await ctx.db
        .query("ninaTurns")
        .withIndex("by_chatId_and_order", (q) =>
          q.eq("chatId", f.chatId).eq("order", 17)
        )
        .unique();
      if (turn) {
        await ctx.db.delete("ninaTurns", turn._id);
      }
    });
    await f.refresh(55);
    expect(provider.languageModel).not.toHaveBeenCalled();
    await expectEarlier(f);
  }, 15_000);

  it("keeps the previous summary when the prompt of the last folded turn is not in the thread", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(56, () => ({ tokens: 2500 }));
    await f.seed(EARLIER_THROUGH, EARLIER);
    await f.t.mutation(async (ctx) => {
      // The summary covers order 1, so a fold covers orders 2 to 17 first.
      const elsewhere = await saveMessage(ctx, components.nina, {
        threadId: await createThread(ctx, components.nina, {
          userId: f.userId,
        }),
        prompt: "Elsewhere",
      });
      const turn = await ctx.db
        .query("ninaTurns")
        .withIndex("by_chatId_and_order", (q) =>
          q.eq("chatId", f.chatId).eq("order", 17)
        )
        .unique();
      if (turn) {
        await ctx.db.patch("ninaTurns", turn._id, {
          promptMessageId: elsewhere.messageId,
        });
      }
    });
    await f.refresh(55);
    expect(provider.languageModel).not.toHaveBeenCalled();
    await expectEarlier(f);
  }, 15_000);

  it("keeps the previous summary when the thread cannot be read", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(9, () => BIG);
    await f.seed(EARLIER_THROUGH, EARLIER);
    await f.refresh(8, "missing-thread");
    await expectEarlier(f);
  });
});
