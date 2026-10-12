import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { createThread, saveMessages } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  nextSummaryTarget,
  RECENT_TURNS,
  refreshSummary,
} from "@repo/backend/confect/nina/summary";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import type { EarlierTurn } from "@repo/backend/test/nina";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { sealedSummary } from "@repo/backend/test/seal";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Predicate } from "effect";

const NOW = Date.UTC(2026, 8, 27, 12);
const read = Ref.getFunctionReference(refs.internal.nina.summaries.read);

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

/**
 * A chat whose Agent thread holds `turns` learner and Nina turns, each with
 * the settled turn row Nina stores. A cancelled turn keeps the answer text it
 * wrote before it stopped, and its prompt is failed, as settlement leaves it.
 */
async function fixture(
  turns: number,
  shape: (order: number) => typeof EarlierTurn.Type = () => ({})
) {
  const t = createConvexTestWithBetterAuth();
  const setup = await t.mutation(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, { now: NOW });
    const threadId = await createThread(ctx, components.nina, { userId });
    const chatId = await ctx.db.insert("chats", {
      userId,
      threadId,
      type: "study",
      visibility: "private",
      updatedAt: NOW,
    });
    let prompts: string[] = [];
    for (let order = 0; order < turns; order += 1) {
      const { cancelled = false, retryOf } = shape(order);
      const { messages } = await saveMessages(ctx, components.nina, {
        threadId,
        order,
        messages: [
          { role: "user", content: `Question ${retryOf ?? order}` },
          { role: "assistant", content: `Answer ${order}` },
        ],
      });
      const promptMessageId = messages[0]?._id ?? "";
      prompts = Arr.append(prompts, promptMessageId);
      if (cancelled) {
        await ctx.runMutation(components.nina.messages.updateMessage, {
          messageId: promptMessageId,
          patch: { status: "failed", error: "cancelled" },
        });
      }
      await ctx.db.insert("ninaTurns", {
        chatId,
        order,
        phase: "settled",
        promptMessageId,
        state: cancelled
          ? { status: "cancelled", finishedAt: NOW }
          : { status: "complete", finishedAt: NOW },
        threadId,
        usage: [],
        userId,
        ...(retryOf === undefined ? {} : { retryOf }),
      });
    }
    return { chatId, prompts, threadId, userId };
  });
  const usageHandler = vi.fn();
  const refresh = (order: number) =>
    t.action((ctx) =>
      Effect.runPromise(
        refreshSummary({ ...setup, order }, usageHandler).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      )
    );
  const summary = () =>
    t.query((ctx) => ctx.db.query("ninaSummaries").collect());
  // The stored text is sealed, so the tests read it the way generation does.
  const text = async () =>
    (await t.query(read, { chatId: setup.chatId }))?.text;
  return { ...setup, refresh, summary, t, text, usageHandler };
}

function summaryModel(text: string) {
  return new MockLanguageModelV4({
    doGenerate: providerStep([{ type: "text", text }]),
  });
}

describe("Nina rolling summary", () => {
  it("folds several turns once they sit beyond the verbatim window", () => {
    expect(nextSummaryTarget(RECENT_TURNS + 2, null)).toBeNull();
    expect(nextSummaryTarget(RECENT_TURNS + 3, null)).toBe(3);
    expect(nextSummaryTarget(10, 3)).toBeNull();
    expect(nextSummaryTarget(11, 3)).toBe(7);
    expect(nextSummaryTarget(55, null)).toBe(15);
    expect(nextSummaryTarget(55, 15)).toBe(31);
  });

  it("summarizes the older turns and keeps the newest turns verbatim", async () => {
    const model = summaryModel("- The learner studied limits.");
    provider.languageModel.mockReturnValue(model);
    const f = await fixture(9);
    await f.refresh(8);
    const rows = await f.summary();
    expect(rows).toEqual([
      expect.objectContaining({
        chatId: f.chatId,
        text: expect.any(ArrayBuffer),
        throughOrder: 4,
      }),
    ]);
    // The fold's tokens go to the ledger of its turn, so the row keeps no total.
    expect(rows[0]).not.toHaveProperty("usage");
    expect(await f.text()).toBe("- The learner studied limits.");
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("None yet.");
    expect(prompt).toContain("Learner: Question 0");
    expect(prompt).toContain("Nina: Answer 4");
    expect(prompt).not.toContain("Question 5");
  });

  it("records the fold's model call in the ledger of the turn that settled, as the summary agent", async () => {
    provider.languageModel.mockReturnValue(
      summaryModel("- The learner studied limits.")
    );
    const f = await fixture(9);
    const turn = await f.t.query((ctx) =>
      ctx.db
        .query("ninaTurns")
        .withIndex("by_chatId_and_order", (q) =>
          q.eq("chatId", f.chatId).eq("order", 8)
        )
        .unique()
    );
    if (!turn) {
      throw new Error("Expected the newest turn of the fixture.");
    }
    await f.t.action((ctx) =>
      Effect.runPromise(
        createUsageHandler(turn._id).pipe(
          Effect.flatMap((usageHandler) =>
            refreshSummary({ ...f, order: 8 }, usageHandler)
          ),
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      )
    );
    const settled = await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id));
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
  });

  it("folds a question the learner asked again once, in its newest asking, and leaves out a cancelled turn", async () => {
    const model = summaryModel("- A tidy fold.");
    provider.languageModel.mockReturnValue(model);
    // Order 2 was cancelled after it wrote some text, and order 3 asks the question of order 1 again.
    const f = await fixture(9, (order) => {
      if (order === 2) {
        return { cancelled: true };
      }
      return order === 3 ? { retryOf: 1 } : {};
    });
    await f.refresh(8);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Learner: Question 0");
    expect(prompt).toContain("Nina: Answer 4");
    expect(prompt.split("Learner: Question 1")).toHaveLength(2);
    expect(prompt).toContain("Nina: Answer 3");
    expect(prompt).not.toContain("Nina: Answer 1");
    expect(prompt).not.toContain("Answer 2");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 4 }),
    ]);
  });

  it("leaves a turn out of the fold when a later turn asks its question again", async () => {
    const model = summaryModel("- A tidy fold.");
    provider.languageModel.mockReturnValue(model);
    // Order 6 sits in the verbatim window and asks the question of order 2 again.
    const f = await fixture(9, (order) => (order === 6 ? { retryOf: 2 } : {}));
    await f.refresh(8);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Learner: Question 1");
    expect(prompt).toContain("Nina: Answer 4");
    expect(prompt).not.toContain("Question 2");
    expect(prompt).not.toContain("Answer 2");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 4 }),
    ]);
  });

  it("leaves out an answer that a retry far ahead of a long backlog replaced", async () => {
    const model = summaryModel("- The first batch of a long chat.");
    provider.languageModel.mockReturnValue(model);
    // A chat of 56 turns that has no summary yet folds orders 0 to 15 first.
    // Order 20 asks the question of order 5 again, 35 turns before the newest.
    const f = await fixture(56, (order) =>
      order === 20 ? { retryOf: 5 } : {}
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
  });

  it("extends an existing summary with the next folded turns", async () => {
    const model = summaryModel("- Limits, then derivatives.");
    provider.languageModel.mockReturnValue(model);
    const f = await fixture(13);
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(
          ctx,
          f.userId,
          "- The learner studied limits."
        ),
        throughOrder: 4,
        updatedAt: NOW,
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    await f.refresh(12);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        text: expect.any(ArrayBuffer),
        throughOrder: 8,
        // The total that the older row holds stays as it was: a refresh adds none.
        usage: { calls: 1, input: 900, output: 120 },
      }),
    ]);
    expect(await f.text()).toBe("- Limits, then derivatives.");
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("- The learner studied limits.");
    expect(prompt).toContain("Question 5");
    expect(prompt).not.toContain("Question 4");
    expect(prompt).not.toContain("Question 9");
  });

  it("folds a long backlog one bounded batch per refresh, paging to its oldest turns", async () => {
    const model = summaryModel("- A long study session.");
    provider.languageModel.mockReturnValue(model);
    const f = await fixture(56);
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
  });

  it("makes no model call before a fold is due", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await fixture(6);
    await f.refresh(5);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
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
      const f = await fixture(9);
      await f.refresh(8);
      expect(await f.summary()).toEqual([]);
    }
  );

  it("reads back only from the prompt of the last folded turn", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- Folded."));
    const f = await fixture(56);
    const anchors = await f.t.action(async (ctx) => {
      const runQuery = vi.spyOn(ctx, "runQuery");
      await Effect.runPromise(
        refreshSummary({ ...f, order: 55 }, f.usageHandler).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      );
      return Arr.flatMap(runQuery.mock.calls, ([, args]) =>
        Predicate.hasProperty(args, "upToAndIncludingMessageId")
          ? [String(args.upToAndIncludingMessageId)]
          : []
      );
    });
    expect(anchors).toEqual([f.prompts[15]]);
  });

  it("stops reading back once it reaches turns the summary covers", async () => {
    const model = summaryModel("- Later study.");
    provider.languageModel.mockReturnValue(model);
    const f = await fixture(62);
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(ctx, f.userId, "- Earlier study."),
        throughOrder: 40,
        updatedAt: NOW,
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    await f.refresh(61);
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Question 41");
    expect(prompt).toContain("Answer 56");
    expect(prompt).not.toContain("Question 40");
    expect(prompt).not.toContain("Question 57");
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 56 }),
    ]);
  });

  it("keeps the previous summary when the last folded turn is missing", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await fixture(9);
    await f.t.mutation(async (ctx) => {
      const turn = await ctx.db
        .query("ninaTurns")
        .withIndex("by_chatId_and_order", (q) =>
          q.eq("chatId", f.chatId).eq("order", 4)
        )
        .unique();
      if (turn) {
        await ctx.db.delete("ninaTurns", turn._id);
      }
    });
    await f.refresh(8);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
  });

  it("keeps the previous summary when the thread cannot be read", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await fixture(9);
    await f.t.action((ctx) =>
      Effect.runPromise(
        refreshSummary(
          {
            chatId: f.chatId,
            order: 8,
            threadId: "missing-thread",
            userId: f.userId,
          },
          f.usageHandler
        ).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      )
    );
    expect(await f.summary()).toEqual([]);
  });
});
