import { Ref } from "@confect/core";
import { createThread, listUIMessages, saveMessages } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";

const convert = Ref.getFunctionReference(refs.internal.migration.nina.convert);

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return {
    ...actual,
    createThread: vi.fn(actual.createThread),
    saveMessages: vi.fn(actual.saveMessages),
  };
});
afterEach(() => vi.restoreAllMocks());

async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: Date.now(), credits: 100 })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const ids = await t.mutation(async (ctx) => {
    const chatId = await ctx.db.insert("chats", {
      userId: identity.userId,
      title: "Original conversation",
      type: "study",
      visibility: "private",
      updatedAt: 1_700_000_000_000,
    });
    const promptId = await ctx.db.insert("messages", {
      chatId,
      role: "user",
      identifier: "prompt",
    });
    await ctx.db.insert("messageParts", {
      messageId: promptId,
      order: 0,
      type: "text",
      textText: "Explain gravity.",
    });
    const answerId = await ctx.db.insert("messages", {
      chatId,
      role: "assistant",
      identifier: "answer",
      modelId: "nakafa-lite",
      credits: 1,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
    await ctx.db.insert("messageParts", {
      messageId: answerId,
      order: 0,
      type: "text",
      textText: "Gravity attracts masses.",
    });
    await ctx.db.insert("messageParts", {
      messageId: answerId,
      order: 1,
      type: "data-suggestions",
      dataSuggestionsData: ["Show an example."],
    });
    const transactionId = await ctx.db.insert("creditTransactions", {
      userId: identity.userId,
      type: "usage",
      amount: -1,
      balanceAfter: 99,
      metadata: {
        chatId,
        messageId: answerId,
        modelId: "nakafa-lite",
        totalTokens: 30,
      },
    });
    const otherId = await ctx.db.insert("creditTransactions", {
      userId: identity.userId,
      type: "bonus",
      amount: 5,
      balanceAfter: 104,
      metadata: { reason: "Existing account adjustment" },
    });
    return { chatId, promptId, answerId, transactionId, otherId };
  });
  return { t, owner, identity, ...ids };
}

describe("Nina history cutover", () => {
  it("paginates only unconverted chats and converts an empty conversation", async () => {
    const f = await fixture();
    await f.t.mutation(convert, { chatId: f.chatId });
    const empty = await f.t.mutation((ctx) =>
      ctx.db.insert("chats", {
        userId: f.identity.userId,
        type: "study",
        visibility: "private",
        updatedAt: 0,
      })
    );
    const page = await f.t.query(
      Ref.getFunctionReference(refs.internal.migration.nina.list),
      {
        paginationOpts: { cursor: null, numItems: 20 },
      }
    );
    expect(page.chatIds).toEqual([empty]);
    expect(page.done).toBe(true);
    expect(await f.t.mutation(convert, { chatId: empty })).toMatchObject({
      messages: 0,
      turns: 0,
    });
  });

  it.each(["messages", "parts", "ledger"] as const)(
    "preserves a chat exceeding its atomic %s bound",
    async (bound) => {
      const f = await fixture();
      await f.t.mutation(async (ctx) => {
        const count = { messages: 101, parts: 201, ledger: 501 }[bound];
        for (let i = 0; i < count; i += 1) {
          if (bound === "messages") {
            await ctx.db.insert("messages", {
              chatId: f.chatId,
              role: "user",
              identifier: `test-${i}`,
            });
          } else if (bound === "parts") {
            await ctx.db.insert("messageParts", {
              messageId: f.promptId,
              order: i + 1,
              type: "text",
              textText: "Test",
            });
          } else {
            await ctx.db.insert("creditTransactions", {
              userId: f.identity.userId,
              type: "bonus",
              amount: 1,
              balanceAfter: 100,
            });
          }
        }
      });
      await expect(f.t.mutation(convert, { chatId: f.chatId })).rejects.toThrow(
        "conversion bound"
      );
      expect(
        (await f.t.query((ctx) => ctx.db.get(f.chatId)))?.threadId
      ).toBeUndefined();
    }
  );

  it.each(["thread", "messages", "receipt"] as const)(
    "rolls back when the Agent %s cannot be committed",
    async (stage) => {
      const f = await fixture();
      if (stage === "thread") {
        vi.mocked(createThread).mockRejectedValueOnce(
          new Error("Thread unavailable")
        );
      } else if (stage === "messages") {
        vi.mocked(saveMessages).mockRejectedValueOnce(
          new Error("Messages unavailable")
        );
      } else {
        vi.mocked(saveMessages).mockResolvedValueOnce({ messages: [] });
      }
      await expect(
        f.t.mutation(convert, { chatId: f.chatId })
      ).rejects.toThrow();
      expect(
        (await f.t.query((ctx) => ctx.db.get(f.chatId)))?.threadId
      ).toBeUndefined();
      expect(
        await f.t.query((ctx) => ctx.db.query("ninaTurns").collect())
      ).toEqual([]);
    }
  );

  it.each([true, false])(
    "preserves a failed response without inventing usage or an error reason (empty: %s)",
    async (empty) => {
      const f = await fixture();
      await f.t.mutation(async (ctx) => {
        for (const part of await ctx.db
          .query("messageParts")
          .withIndex("by_messageId_and_order", (q) =>
            q.eq("messageId", f.answerId)
          )
          .collect()) {
          if (empty) {
            await ctx.db.delete(part._id);
          }
        }
        await ctx.db.delete(f.transactionId);
        await ctx.db.patch(f.answerId, {
          generationStatus: "failed",
          credits: undefined,
          modelId: undefined,
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined,
        });
      });
      await f.t.mutation(convert, { chatId: f.chatId });
      const [turn] = await f.t.query((ctx) =>
        ctx.db.query("ninaTurns").collect()
      );
      expect(turn?.state).toMatchObject({
        status: "failed",
        reason: "unknown",
      });
      expect(turn?.usage).toEqual([]);
      expect(turn?.transactionId).toBeUndefined();
      expect(turn?.credits).toBeUndefined();
    }
  );

  it("refuses a transcript whose original opening prompt is missing", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) => ctx.db.delete(f.promptId));
    await expect(f.t.mutation(convert, { chatId: f.chatId })).rejects.toThrow(
      "original user prompt"
    );
    expect(
      (await f.t.query((ctx) => ctx.db.get(f.chatId)))?.threadId
    ).toBeUndefined();
  });
  it("moves the transcript and ledger references together without changing financial facts", async () => {
    const { t, identity, chatId, transactionId, otherId, promptId, answerId } =
      await fixture();
    const before = await t.query(async (ctx) => ({
      prompt: await ctx.db.get(promptId),
      answer: await ctx.db.get(answerId),
      adjustment: await ctx.db.get(otherId),
      user: await ctx.db.get(identity.userId),
    }));
    const result = await t.mutation(convert, { chatId });
    const state = await t.query(async (ctx) => ({
      chat: await ctx.db.get(chatId),
      turns: await ctx.db.query("ninaTurns").collect(),
      usage: await ctx.db.get(transactionId),
      adjustment: await ctx.db.get(otherId),
      user: await ctx.db.get(identity.userId),
      messages: await listUIMessages(ctx, components.nina, {
        threadId: result.threadId,
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    }));
    expect(result).toMatchObject({ messages: 2, turns: 1 });
    expect(state.chat).toMatchObject({
      title: "Original conversation",
      updatedAt: 1_700_000_000_000,
    });
    expect(state.turns).toEqual([
      expect.objectContaining({
        phase: "settled",
        chatId,
        threadId: result.threadId,
        promptedAt: before.prompt?._creationTime,
        state: { status: "complete", finishedAt: before.answer?._creationTime },
        credits: 1,
        modelId: "nakafa-lite",
        transactionId,
        tokens: { input: 10, output: 20, total: 30 },
      }),
    ]);
    const answer = state.messages.page.find(
      (message) => message.role === "assistant"
    );
    expect(state.usage).toMatchObject({
      amount: -1,
      balanceAfter: 99,
      metadata: {
        chatId,
        messageId: answer?.id,
        turnId: state.turns[0]?._id,
        modelId: "nakafa-lite",
        totalTokens: 30,
      },
    });
    expect(state.adjustment).toEqual(before.adjustment);
    expect(state.user).toEqual(before.user);
    expect(await t.mutation(convert, { chatId })).toEqual({
      threadId: result.threadId,
      messages: 0,
      turns: 0,
    });
    expect(await t.query((ctx) => ctx.db.query("ninaTurns").collect())).toEqual(
      state.turns
    );
  });

  it("preserves unanswered prompts with their original dates and allows retry", async () => {
    const { t, owner, chatId } = await fixture();
    const originals = await t.mutation(async (ctx) => {
      const messages: (Docs["messages"] | null)[] = [];
      for (const text of [
        "A follow-up without an answer.",
        "Another prompt.",
      ]) {
        const id = await ctx.db.insert("messages", {
          chatId,
          role: "user",
          identifier: text,
        });
        await ctx.db.insert("messageParts", {
          messageId: id,
          order: 0,
          type: "text",
          textText: text,
        });
        messages.push(await ctx.db.get(id));
      }
      return messages;
    });
    const converted = await t.mutation(convert, { chatId });
    expect(converted.turns).toBe(3);
    const result = Ref.decodeReturnsSync(
      refs.public.nina.messages.list,
      await owner.query(
        Ref.getFunctionReference(refs.public.nina.messages.list),
        {
          chatId,
          threadId: converted.threadId,
          paginationOpts: { cursor: null, numItems: 20 },
        }
      )
    );
    const unanswered = result.page.filter(
      (message) => message.metadata?.state.status === "unanswered"
    );
    expect(unanswered).toHaveLength(2);
    expect(
      unanswered
        .sort((a, b) => a.order - b.order)
        .map((message) => message._creationTime)
    ).toEqual(originals.map((message) => message?._creationTime));
    await expect(
      owner.mutation(Ref.getFunctionReference(refs.public.nina.turns.start), {
        chatId,
        requestId: "retry-without-context",
        modelId: "nakafa-lite",
        input: { kind: "retry", order: 2 },
      })
    ).rejects.toMatchObject({ data: { code: "NINA_RETRY_UNAVAILABLE" } });
    const receipt = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(
        Ref.getFunctionReference(refs.public.nina.turns.start),
        {
          chatId,
          requestId: "retry-unanswered",
          modelId: "nakafa-lite",
          input: {
            kind: "retry",
            order: 2,
            page: { locale: "en", slug: "home" },
          },
        }
      )
    );
    expect(receipt.prompt.text).toBe("Another prompt.");
    expect(receipt.order).toBe(3);
  });

  it("rejects old prompt writes after conversion and refunds late responses only once", async () => {
    const { t, owner, identity, chatId } = await fixture();
    await t.mutation(convert, { chatId });
    await expect(
      owner.mutation(api.chats.mutations.saveMessage, {
        message: { chatId, role: "user", identifier: "stale-prompt" },
        parts: [],
      })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    for (const failed of [false, true]) {
      const turnId = await owner.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-lite",
      });
      const args = {
        userId: identity.userId,
        turnId,
        message: {
          chatId,
          identifier: "late-response",
          modelId: "nakafa-lite" as const,
        },
      };
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = failed
          ? await t.mutation(
              internal.chats.assistantResponses.saveAssistantFailure,
              {
                ...args,
                message: {
                  ...args.message,
                  generationErrorCode: "CHAT_RESPONSE_FAILED",
                },
              }
            )
          : await t.mutation(
              internal.chats.assistantResponses.saveAssistantResponse,
              {
                ...args,
                message: { ...args.message, role: "assistant" },
                parts: [],
              }
            );
        expect(result).toBeNull();
      }
    }
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get(identity.userId),
      messages: await ctx.db.query("messages").collect(),
      refunds: await ctx.db
        .query("creditTransactions")
        .filter((q) => q.eq(q.field("type"), "refund"))
        .collect(),
    }));
    expect(state.user?.credits).toBe(100);
    expect(state.messages).toHaveLength(2);
    expect(state.refunds).toHaveLength(2);
  });

  it("waits for a running response and leaves the transcript untouched", async () => {
    const { t, owner, chatId } = await fixture();
    await owner.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    await expect(t.mutation(convert, { chatId })).rejects.toThrow(
      "A response is still running"
    );
    expect(
      (await t.query((ctx) => ctx.db.get(chatId)))?.threadId
    ).toBeUndefined();
    expect(await t.query((ctx) => ctx.db.query("ninaTurns").collect())).toEqual(
      []
    );
  });

  it("rolls back an incomplete conversion instead of presenting partial history", async () => {
    const { t, chatId } = await fixture();
    await t.mutation((ctx) =>
      ctx.db.insert("messages", {
        chatId,
        role: "assistant",
        identifier: "empty-unclassified-response",
      })
    );
    await expect(t.mutation(convert, { chatId })).rejects.toThrow(
      "An empty message has no recorded failure"
    );
    expect(
      (await t.query((ctx) => ctx.db.get(chatId)))?.threadId
    ).toBeUndefined();
    expect(await t.query((ctx) => ctx.db.query("ninaTurns").collect())).toEqual(
      []
    );
  });
});
