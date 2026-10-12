import { createThread, saveMessage } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import { sentTurn } from "@repo/backend/confect/nina/history";
import { provider } from "@repo/backend/test/gateway";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { createSummaryTest } from "@repo/backend/test/nina/summary";
import { sealedSummary } from "@repo/backend/test/seal";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Predicate } from "effect";

/** A turn whose answer costs about 6,000 tokens, so six of them outweigh the history budget. */
const BIG = { tokens: 6000 } as const;

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

function summaryModel(text: string) {
  return new MockLanguageModelV4({
    doGenerate: providerStep([{ type: "text", text }]),
  });
}

describe("Nina rolling summary", () => {
  it("makes no model call while the turns fit, and the model input holds all of them word for word", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(21);
    await f.refresh(19);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
    // Twenty turns are more than the sixteen one fold covers.
    const shown = encodeJsonText(await f.input(20));
    for (const order of Arr.range(0, 19)) {
      expect(shown).toContain(`"Question ${order}"`);
      expect(shown).toContain(`"Answer ${order}"`);
    }
  }, 15_000);

  it("summarizes the oldest of three large turns, so the newest stays within half the budget and no turn is lost", async () => {
    const model = summaryModel("- The learner studied limits.");
    provider.languageModel.mockReturnValue(model);
    // Three turns of 13,000 tokens cost 39,000, more than the budget of 32,000.
    // A fourth turn holds the question that is asked next.
    const f = await createSummaryTest(4, (order) =>
      order < 3 ? { tokens: 13_000 } : {}
    );
    await f.refresh(2);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        chatId: f.chatId,
        text: expect.any(ArrayBuffer),
        throughOrder: 1,
        // The fold's provider usage counts toward the chat's summary upkeep.
        usage: { calls: 1, input: 12, output: 4 },
      }),
    ]);
    expect(await f.text()).toBe("- The learner studied limits.");
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("None yet.");
    expect(prompt).toContain("Learner: Question 0");
    expect(prompt).toContain("Nina: Answer 1");
    expect(prompt).not.toContain("Question 2");
    // What stays costs at most half the budget, and every turn is in the summary or the input.
    const shown = await f.input(3);
    expect(sentTurn(Arr.dropRight(shown, 2)).tokens).toBeLessThanOrEqual(
      NINA_BUDGET.history / 2
    );
    const through = (await f.stored())?.throughOrder ?? -1;
    for (const order of Arr.range(0, 2)) {
      expect(
        order <= through ||
          encodeJsonText(shown).includes(`"Question ${order}"`)
      ).toBe(true);
    }
  });

  it("grows the history only at its end between two folds", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    // Six turns of about 5,000 tokens cost 30,000, and the budget is 32,000.
    const f = await createSummaryTest(7, () => ({ tokens: 5000 }));
    let before = Arr.dropRight(await f.input(1), 2);
    for (const settled of Arr.range(1, 5)) {
      await f.refresh(settled);
      const history = Arr.dropRight(await f.input(settled + 1), 2);
      expect(history.length).toBeGreaterThan(before.length);
      expect(Arr.take(history, before.length)).toEqual(before);
      before = history;
    }
    expect(provider.languageModel).not.toHaveBeenCalled();
  }, 15_000);

  it("leaves no turn in neither the summary nor the history, after any turn settles", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- A study session."));
    // Each turn costs about 9,000 tokens: a fold comes every four or so.
    const f = await createSummaryTest(14, () => ({ tokens: 9000 }));
    for (const settled of Arr.range(0, 12)) {
      await f.refresh(settled);
      const through = (await f.stored())?.throughOrder ?? -1;
      const shown = encodeJsonText(await f.input(settled + 1));
      expect(
        Arr.filter(
          Arr.range(0, settled),
          (order) => order > through && !shown.includes(`"Question ${order}"`)
        )
      ).toEqual([]);
    }
    // The summary folded more than once, and the history never outgrew the budget.
    expect((await f.stored())?.throughOrder).toBeGreaterThan(2);
    // The turn being answered is the last two messages, its question and answer.
    const history = Arr.dropRight(await f.input(13), 2);
    expect(sentTurn(history).tokens).toBeLessThanOrEqual(NINA_BUDGET.history);
  }, 30_000);

  it("does not fold a turn larger than the whole budget while it is the newest, and folds it once another turn follows", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- One long answer."));
    const f = await createSummaryTest(2, (order) =>
      order === 0 ? { tokens: NINA_BUDGET.history + 8000 } : {}
    );
    await f.refresh(0);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
    await f.refresh(1);
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 0 }),
    ]);
  });

  it("keeps the previous summary when the fold fails, and the next model input stays inside the history budget", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: () => Promise.reject(new Error("Provider down")),
      })
    );
    // Four turns of 12,000 tokens cost more than the budget, and none is folded.
    const f = await createSummaryTest(5, () => ({ tokens: 12_000 }));
    await f.refresh(3);
    expect(await f.summary()).toEqual([]);
    const shown = await f.input(4);
    expect(sentTurn(Arr.dropRight(shown, 2)).tokens).toBeLessThanOrEqual(
      NINA_BUDGET.history
    );
    // The oldest turns that no longer fit leave this input, and the newest stay.
    expect(encodeJsonText(shown)).not.toContain('"Question 0"');
    expect(encodeJsonText(shown)).toContain('"Question 3"');
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
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(
          ctx,
          f.userId,
          "- The learner studied limits."
        ),
        throughOrder: 4,
        updatedAt: f.now,
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    await f.refresh(12);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        text: expect.any(ArrayBuffer),
        throughOrder: 9,
        usage: { calls: 2, input: 912, output: 124 },
      }),
    ]);
    expect(await f.text()).toBe("- Limits, then derivatives.");
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("- The learner studied limits.");
    expect(prompt).toContain("Question 5");
    expect(prompt).not.toContain("Question 4");
    expect(prompt).not.toContain("Question 10");
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

  it("records zero tokens when the provider omits usage counters", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: () =>
          Promise.resolve({
            content: [{ type: "text", text: "- A counted fold." }],
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: undefined,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: undefined,
                text: undefined,
                reasoning: undefined,
              },
            },
            warnings: [],
          }),
      })
    );
    const f = await createSummaryTest(9, () => BIG);
    await f.refresh(8);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        text: expect.any(ArrayBuffer),
        usage: { calls: 1, input: 0, output: 0 },
      }),
    ]);
    expect(await f.text()).toBe("- A counted fold.");
  });

  it.each(["provider", "empty"] as const)(
    "keeps the previous summary when the %s answer fails",
    async (failure) => {
      provider.languageModel.mockReturnValue(
        failure === "provider"
          ? new MockLanguageModelV4({
              doGenerate: () => Promise.reject(new Error("Provider down")),
            })
          : summaryModel("   ")
      );
      const f = await createSummaryTest(9, () => BIG);
      await f.refresh(8);
      expect(await f.summary()).toEqual([]);
    }
  );

  it("reads back only from the prompt of the last folded turn", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- Folded."));
    const f = await createSummaryTest(56, () => ({ tokens: 2500 }));
    const queries = await f.refresh(55);
    // The transcript read leaves tool messages out, unlike the read of the turns that decides the fold.
    const anchors = Arr.flatMap(queries, (args) =>
      Predicate.hasProperty(args, "excludeToolMessages") &&
      args.excludeToolMessages === true &&
      Predicate.hasProperty(args, "upToAndIncludingMessageId")
        ? [String(args.upToAndIncludingMessageId)]
        : []
    );
    expect(anchors).toEqual([f.prompts[15]]);
  }, 15_000);

  it("stops reading back once it reaches turns the summary covers", async () => {
    const model = summaryModel("- Later study.");
    provider.languageModel.mockReturnValue(model);
    const f = await createSummaryTest(62, () => ({ tokens: 2500 }));
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(ctx, f.userId, "- Earlier study."),
        throughOrder: 40,
        updatedAt: f.now,
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    await f.refresh(61);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Question 41");
    expect(prompt).toContain("Answer 55");
    expect(prompt).not.toContain("Question 40");
    expect(prompt).not.toContain("Question 56");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 55 }),
    ]);
  }, 15_000);

  it("keeps the previous summary when the last folded turn is missing", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(56, () => ({ tokens: 2500 }));
    await f.t.mutation(async (ctx) => {
      // A chat of 56 turns without a summary folds through order 15 first.
      const turn = await ctx.db
        .query("ninaTurns")
        .withIndex("by_chatId_and_order", (q) =>
          q.eq("chatId", f.chatId).eq("order", 15)
        )
        .unique();
      if (turn) {
        await ctx.db.delete("ninaTurns", turn._id);
      }
    });
    await f.refresh(55);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
  }, 15_000);

  it("keeps the previous summary when the prompt of the last folded turn is not in the thread", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(9, () => BIG);
    await f.t.mutation(async (ctx) => {
      // Nine turns of 6,000 tokens fold through order 6.
      const elsewhere = await saveMessage(ctx, components.nina, {
        threadId: await createThread(ctx, components.nina, {
          userId: f.userId,
        }),
        prompt: "Elsewhere",
      });
      const turn = await ctx.db
        .query("ninaTurns")
        .withIndex("by_chatId_and_order", (q) =>
          q.eq("chatId", f.chatId).eq("order", 6)
        )
        .unique();
      if (turn) {
        await ctx.db.patch("ninaTurns", turn._id, {
          promptMessageId: elsewhere.messageId,
        });
      }
    });
    await f.refresh(8);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
  });

  it("keeps the previous summary when the thread cannot be read", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(9, () => BIG);
    await f.refresh(8, "missing-thread");
    expect(await f.summary()).toEqual([]);
  });
});
