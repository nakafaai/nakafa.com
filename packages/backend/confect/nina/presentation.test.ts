import { Ref } from "@confect/core";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { deployment, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaModel } from "@repo/backend/test/nina";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { Array as Arr, Effect, Order } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});
const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const present = Ref.getFunctionReference(refs.internal.nina.response.present);
const save = Ref.getFunctionReference(refs.internal.nina.presentation.save);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);

// This suite exercises presentation through response generation and its real component journal.
describe("Nina presentation after an answer", () => {
  it.each(["provider", "output"] as const)(
    "keeps the completed answer and charge when %s presentation fails",
    async (failure) => {
      const f = await createNinaTest();
      const model = ninaModel();
      model.doGenerate =
        failure === "provider"
          ? () => Promise.reject(new Error("Private provider diagnostic"))
          : () => Promise.resolve(providerStep([{ type: "text", text: "" }]));
      provider.languageModel.mockReturnValue(model);
      await f.t.action(run, { turnId: f.turnId });
      await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
      const state = await f.t.query(async (ctx) => ({
        turn: await ctx.db.get("ninaTurns", f.turnId),
        user: await ctx.db.get("users", f.identity.userId),
        chat: await ctx.db.get("chats", f.chatId),
      }));
      expect(state.turn?.state.status).toBe("complete");
      expect(state.turn?.suggestions).toBeUndefined();
      expect(state.chat?.title).toBeUndefined();
      expect(state.user?.credits).toBe(8);
    }
  );

  it("generates follow-up suggestions without renaming a later conversation", async () => {
    const f = await createNinaTest();
    await f.t.mutation(async (ctx) => {
      const prompt = await saveMessage(ctx, components.nina, {
        threadId: f.threadId,
        userId: f.identity.userId,
        prompt: "A second question",
      });
      await ctx.db.patch("ninaTurns", f.turnId, {
        order: prompt.message.order,
        promptMessageId: prompt.messageId,
      });
    });
    const model = ninaModel();
    provider.languageModel.mockReturnValue(model);
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(model.doGenerateCalls).toHaveLength(1);
    const prompt = model.doGenerateCalls[0]?.prompt;
    expect(prompt?.at(-1)?.role).toBe("user");
    expect(prompt?.at(-2)).toMatchObject({
      role: "assistant",
      content: [
        {
          type: "text",
          text: "A limit describes the value approached.",
        },
      ],
    });
    const messages = await f.t.query(
      components.nina.messages.listMessagesByThreadId,
      {
        threadId: f.threadId,
        paginationOpts: { cursor: null, numItems: 10 },
        order: "asc",
      }
    );
    expect(
      Arr.filter(messages.page, (message) => message.message?.role === "user")
    ).toHaveLength(2);
    expect(messages.page.at(-1)?.message).toMatchObject({
      role: "assistant",
    });
    expect(
      (await f.t.query((ctx) => ctx.db.get("chats", f.chatId)))?.activeTurnId
    ).toBeUndefined();
    expect(
      (await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId)))?.state
        .status
    ).toBe("complete");
    expect(
      (await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId)))?.suggestions
    ).toEqual(["How does this relate to continuity?"]);
  });

  it("releases the chat before metadata, anchors its context and accounts for late usage", async () => {
    const f = await createNinaTest();
    const model = ninaModel();
    provider.languageModel.mockReturnValue(model);
    await f.t.action(run, { turnId: f.turnId });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(
      (await f.t.query((ctx) => ctx.db.get("chats", f.chatId)))?.activeTurnId
    ).toBeUndefined();
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    ).toMatchObject({
      state: { status: "complete" },
      tokens: { input: 12, output: 4, total: 16 },
    });
    await f.t.mutation((ctx) =>
      saveMessage(ctx, components.nina, {
        threadId: f.threadId,
        userId: f.identity.userId,
        prompt: "Now explain a completely different subject: photosynthesis.",
      })
    );
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    const [suggestions, title] = model.doGenerateCalls;
    expect(JSON.stringify(suggestions?.prompt)).toContain("Explain a limit.");
    expect(JSON.stringify(suggestions?.prompt)).toContain(
      "A limit describes the value approached."
    );
    expect(JSON.stringify(suggestions?.prompt)).not.toContain("photosynthesis");
    expect(suggestions?.prompt.at(-1)?.role).toBe("user");
    expect(JSON.stringify(title?.prompt)).toContain("Explain a limit.");
    expect(JSON.stringify(title?.prompt)).not.toContain(
      "A limit describes the value approached."
    );
    expect(JSON.stringify(title?.prompt)).not.toContain("photosynthesis");
    const state = await f.t.query(async (ctx) => ({
      turn: await ctx.db.get("ninaTurns", f.turnId),
      user: await ctx.db.get("users", f.identity.userId),
      chat: await ctx.db.get("chats", f.chatId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(state.turn?.tokens).toEqual({ input: 36, output: 12, total: 48 });
    expect(
      Arr.sort(
        Arr.map(state.turn?.usage ?? [], (row) => row.agent),
        Order.String
      )
    ).toEqual(["nina", "suggestions", "title"]);
    expect(state.turn?.suggestions).toEqual([
      "How does this relate to continuity?",
    ]);
    expect(state.chat?.title).toBe("Understanding A Function Limit");
    expect(state.user?.credits).toBe(8);
    expect(state.ledger).toHaveLength(1);
  });

  it.each([
    "active",
    "cancelled",
    "failed",
    "missing-turn",
    "missing-user",
    "missing-chat",
    "deleting-user",
    "missing-context",
  ] as const)("skips deferred generation for %s state", async (state) => {
    const f = await createNinaTest();
    provider.languageModel.mockReturnValue(ninaModel());
    if (state === "cancelled") {
      await f.owner.mutation(cancel, { chatId: f.chatId });
    } else if (state === "failed") {
      await f.t.mutation(
        Ref.getFunctionReference(refs.internal.nina.lifecycle.recover),
        { turnId: f.turnId }
      );
    } else if (state !== "active") {
      await f.t.action(run, { turnId: f.turnId });
    }
    await f.t.mutation(async (ctx) => {
      if (state === "missing-turn") {
        await ctx.db.delete("ninaTurns", f.turnId);
      }
      if (state === "missing-user") {
        await ctx.db.delete("users", f.identity.userId);
      }
      if (state === "missing-chat") {
        await ctx.db.delete("chats", f.chatId);
      }
      if (state === "deleting-user") {
        await ctx.db.patch("users", f.identity.userId, {
          deletionPreparedAt: Date.now(),
        });
      }
      if (state === "missing-context") {
        await ctx.db.patch("ninaTurns", f.turnId, { page: undefined });
      }
    });
    provider.languageModel.mockClear();
    await expect(f.t.action(present, { turnId: f.turnId })).resolves.toBeNull();
    expect(provider.languageModel).not.toHaveBeenCalled();
  });

  it("keeps a settled answer when optional generation loses provider configuration", async () => {
    const f = await createNinaTest();
    provider.languageModel.mockReturnValue(ninaModel());
    await f.t.action(run, { turnId: f.turnId });
    deployment.mockReturnValue(
      Effect.fail(new GatewayConfigurationError({ message: "Unavailable" }))
    );
    provider.languageModel.mockClear();
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    ).toMatchObject({ state: { status: "complete" } });
    expect(provider.languageModel).not.toHaveBeenCalled();
  });

  it("never overwrites an edited title, and replaces only the default title", async () => {
    const f = await createNinaTest();
    await f.t.mutation((ctx) =>
      ctx.db.patch("chats", f.chatId, { title: "New Chat" })
    );
    await f.t.mutation(save, { turnId: f.turnId, title: "Generated title" });
    await f.t.mutation(save, {
      turnId: f.turnId,
      title: "Another generated title",
      suggestions: ["A relevant follow-up?"],
    });
    expect(
      await f.t.query((ctx) => ctx.db.get("chats", f.chatId))
    ).toMatchObject({ title: "Generated title" });
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    ).toMatchObject({ suggestions: ["A relevant follow-up?"] });
  });

  it.each(["cancelled", "failed", "missing-turn", "missing-chat"] as const)(
    "ignores late metadata for a %s conversation",
    async (state) => {
      const f = await createNinaTest();
      if (state === "cancelled") {
        await f.owner.mutation(cancel, { chatId: f.chatId });
      }
      if (state === "failed") {
        await f.t.mutation(
          Ref.getFunctionReference(refs.internal.nina.lifecycle.recover),
          { turnId: f.turnId }
        );
      }
      if (state === "missing-turn") {
        await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
      }
      if (state === "missing-chat") {
        await f.t.mutation((ctx) => ctx.db.delete("chats", f.chatId));
      }
      await expect(
        f.t.mutation(save, {
          turnId: f.turnId,
          title: "Late title",
          suggestions: ["Late suggestion"],
        })
      ).resolves.toBeNull();
      const turn = await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId));
      expect(turn?.suggestions).toBeUndefined();
    }
  );
  it("ignores a scheduled action after the user has cancelled its turn", async () => {
    const f = await createNinaTest();
    await f.owner.mutation(cancel, { chatId: f.chatId });
    await f.t.action(run, { turnId: f.turnId });
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(
      (await f.t.query((ctx) => ctx.db.get("users", f.identity.userId)))
        ?.credits
    ).toBe(10);
  });
});
