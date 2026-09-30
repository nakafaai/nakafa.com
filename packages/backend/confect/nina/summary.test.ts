import { RegisteredFunction } from "@confect/server";
import { createThread, saveMessages } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import {
  nextSummaryTarget,
  RECENT_TURNS,
  refreshSummary,
} from "@repo/backend/confect/nina/summary";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/config/provider", async (original) => ({
  ...(await original<
    typeof import("@repo/backend/confect/nina/config/provider")
  >()),
  getGatewayModel: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

/** A chat whose Agent thread holds `turns` complete learner and Nina turns. */
async function fixture(turns: number) {
  const t = createConvexTestWithBetterAuth();
  const setup = await t.mutation(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, { now: Date.now() });
    const threadId = await createThread(ctx, components.nina, { userId });
    for (let order = 0; order < turns; order += 1) {
      await saveMessages(ctx, components.nina, {
        threadId,
        order,
        messages: [
          { role: "user", content: `Question ${order}` },
          { role: "assistant", content: `Answer ${order}` },
        ],
      });
    }
    const chatId = await ctx.db.insert("chats", {
      userId,
      threadId,
      type: "study",
      visibility: "private",
      updatedAt: Date.now(),
    });
    return { chatId, threadId, userId };
  });
  const refresh = (order: number) =>
    t.action((ctx) =>
      Effect.runPromise(
        refreshSummary({ ...setup, order }).pipe(
          Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
        )
      )
    );
  const summary = () =>
    t.query((ctx) => ctx.db.query("ninaSummaries").collect());
  return { ...setup, refresh, summary, t };
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
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
    const f = await fixture(9);
    await f.refresh(8);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        chatId: f.chatId,
        text: "- The learner studied limits.",
        throughOrder: 4,
        // The fold's provider usage counts toward the chat's summary upkeep.
        usage: { calls: 1, input: 12, output: 4 },
      }),
    ]);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("None yet.");
    expect(prompt).toContain("Learner: Question 0");
    expect(prompt).toContain("Nina: Answer 4");
    expect(prompt).not.toContain("Question 5");
  });

  it("extends an existing summary with the next folded turns", async () => {
    const model = summaryModel("- Limits, then derivatives.");
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
    const f = await fixture(13);
    await f.t.mutation((ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: "- The learner studied limits.",
        throughOrder: 4,
        updatedAt: Date.now(),
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    await f.refresh(12);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        text: "- Limits, then derivatives.",
        throughOrder: 8,
        usage: { calls: 2, input: 912, output: 124 },
      }),
    ]);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("- The learner studied limits.");
    expect(prompt).toContain("Question 5");
    expect(prompt).not.toContain("Question 4");
    expect(prompt).not.toContain("Question 9");
  });

  it("folds a long backlog one bounded batch per refresh, paging to its oldest turns", async () => {
    const model = summaryModel("- A long study session.");
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
    const f = await fixture(56);
    await f.refresh(55);
    await f.refresh(55);
    const [first, second] = model.doGenerateCalls.map((call) =>
      JSON.stringify(call.prompt)
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

  it("records zero tokens when the provider omits usage counters", async () => {
    vi.mocked(getGatewayModel).mockReturnValue(
      Effect.succeed(
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
      )
    );
    const f = await fixture(9);
    await f.refresh(8);
    expect(await f.summary()).toEqual([
      expect.objectContaining({
        text: "- A counted fold.",
        usage: { calls: 1, input: 0, output: 0 },
      }),
    ]);
  });

  it("makes no model call before a fold is due", async () => {
    vi.mocked(getGatewayModel).mockReturnValue(
      Effect.succeed(summaryModel("unused"))
    );
    const f = await fixture(6);
    await f.refresh(5);
    expect(getGatewayModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
  });

  it.each(["provider", "empty"] as const)(
    "keeps the previous summary when the %s answer fails",
    async (failure) => {
      vi.mocked(getGatewayModel).mockReturnValue(
        Effect.succeed(
          failure === "provider"
            ? new MockLanguageModelV4({
                doGenerate: () => Promise.reject(new Error("Provider down")),
              })
            : summaryModel("   ")
        )
      );
      const f = await fixture(9);
      await f.refresh(8);
      expect(await f.summary()).toEqual([]);
    }
  );

  it("keeps the previous summary when the thread cannot be read", async () => {
    vi.mocked(getGatewayModel).mockReturnValue(
      Effect.succeed(summaryModel("unused"))
    );
    const f = await fixture(1);
    await f.t.action((ctx) =>
      Effect.runPromise(
        refreshSummary({
          chatId: f.chatId,
          order: 8,
          threadId: "missing-thread",
          userId: f.userId,
        }).pipe(Effect.provide(RegisteredFunction.actionLayer(schema, ctx)))
      )
    );
    expect(await f.summary()).toEqual([]);
  });
});
