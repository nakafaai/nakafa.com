import { Ref } from "@confect/core";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { deployment, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaModel } from "@repo/backend/test/nina";
import { sealThreadIn, writtenThreadIn } from "@repo/backend/test/nina/seal";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { showsText } from "@repo/backend/test/seal";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Option, Order } from "effect";

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
const NOW = Date.UTC(2026, 8, 27, 12);
const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const present = Ref.getFunctionReference(refs.internal.nina.response.present);
const save = Ref.getFunctionReference(refs.internal.nina.presentation.save);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const rename = Ref.getFunctionReference(
  refs.public.chats.mutations.updateChatTitle
);

/** The title the owner reads for the chat, opened the way every reader opens it. */
async function readTitle(f: Awaited<ReturnType<typeof createNinaTest>>) {
  return (await f.owner.query(getChat, { chatId: f.chatId })).title;
}

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
      expect(state.user?.credits).toBe(0);
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
    const prompt = model.doGenerateCalls[0]?.prompt ?? [];
    expect(Option.getOrThrow(Arr.last(prompt)).role).toBe("user");
    expect(Option.getOrThrow(Arr.get(prompt, prompt.length - 2))).toMatchObject(
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "A limit describes the value approached.",
          },
        ],
      }
    );
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
    expect(Option.getOrThrow(Arr.last(messages.page)).message).toMatchObject({
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

  /**
   * The model calls of one answered turn with its follow-up, and the input of each.
   * With `copy` other than plain, the rows of the chat are written by the writers
   * after the answer, and with `sealed` they are then sealed in place, both before
   * the follow-up reads them, so every row the follow-up reads is opened.
   */
  async function followUpInput(
    history: number,
    copy: "plain" | "written" | "sealed"
  ) {
    const f = await createNinaTest({ history });
    const model = ninaModel();
    provider.languageModel.mockReturnValue(model);
    await f.t.action(run, { turnId: f.turnId });
    if (copy !== "plain") {
      await writtenThreadIn(f.t, f.threadId, f.identity.userId);
    }
    if (copy === "sealed") {
      await sealThreadIn(f.t, f.threadId, f.identity.userId);
    }
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    return Arr.map(model.doGenerateCalls, (call) => call.prompt);
  }

  it("sends the model the same follow-up input for a sealed chat as for a plain one", async () => {
    const plain = await followUpInput(2, "plain");
    expect(await followUpInput(2, "written")).toEqual(plain);
    const sealed = await followUpInput(2, "sealed");
    expect(sealed).toEqual(plain);
    expect(encodeJsonText(sealed)).toContain("Earlier question 1");
  });

  it("sends the model the same title input and follow-up input for a sealed first turn as for a plain one", async () => {
    const plain = await followUpInput(0, "plain");
    expect(await followUpInput(0, "written")).toEqual(plain);
    const sealed = await followUpInput(0, "sealed");
    expect(sealed).toEqual(plain);
    expect(encodeJsonText(sealed)).toContain("Explain a limit.");
  });

  it("sends the model the same follow-up input for a sealed long chat as for a plain one", async () => {
    const plain = await followUpInput(30, "plain");
    expect(await followUpInput(30, "written")).toEqual(plain);
    const sealed = await followUpInput(30, "sealed");
    expect(sealed).toEqual(plain);
    expect(encodeJsonText(sealed)).toContain("Earlier question 23");
  });

  it("keeps the answer and the default title when the learner's key is gone before the follow-up reads the chat", async () => {
    const f = await createNinaTest();
    const model = ninaModel();
    provider.languageModel.mockReturnValue(model);
    await f.t.action(run, { turnId: f.turnId });
    const titleBefore = await readTitle(f);
    await writtenThreadIn(f.t, f.threadId, f.identity.userId);
    await sealThreadIn(f.t, f.threadId, f.identity.userId);
    await f.t.mutation(async (ctx) => {
      const keys = await ctx.db.query("vaultKeys").collect();
      for (const key of keys) {
        if (key.userId === f.identity.userId) {
          await ctx.db.delete(key._id);
        }
      }
    });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(
      encodeJsonText(Arr.map(model.doGenerateCalls, (call) => call.prompt))
    ).not.toContain("Generate follow-up suggestions");
    expect(await readTitle(f)).toBe(titleBefore);
    expect((await f.inspect()).turn?.state.status).toBe("complete");
  });

  it("gives the follow-up suggestions the latest exchanges of a long chat and no older one", async () => {
    const f = await createNinaTest({ history: 30 });
    const model = ninaModel();
    provider.languageModel.mockReturnValue(model);
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    const prompt = model.doGenerateCalls[0]?.prompt ?? [];
    // Sixteen messages are eight exchanges, the one just answered included,
    // and the request for suggestions is one more message of the learner. The
    // call read all 50 messages it was allowed before, which made 26.
    expect(Arr.filter(prompt, ({ role }) => role === "user")).toHaveLength(9);
    expect(encodeJsonText(prompt)).toContain("Earlier question 23");
    expect(encodeJsonText(prompt)).not.toContain("Earlier question 22");
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
    expect(encodeJsonText(suggestions?.prompt)).toContain("Explain a limit.");
    expect(encodeJsonText(suggestions?.prompt)).toContain(
      "A limit describes the value approached."
    );
    expect(encodeJsonText(suggestions?.prompt)).not.toContain("photosynthesis");
    expect(Option.getOrThrow(Arr.last(suggestions?.prompt ?? [])).role).toBe(
      "user"
    );
    expect(encodeJsonText(title?.prompt)).toContain("Explain a limit.");
    expect(encodeJsonText(title?.prompt)).not.toContain(
      "A limit describes the value approached."
    );
    expect(encodeJsonText(title?.prompt)).not.toContain("photosynthesis");
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
    expect(state.chat?.title).toBeInstanceOf(ArrayBuffer);
    expect(showsText(state.chat?.title, "Understanding A Function Limit")).toBe(
      false
    );
    expect(await readTitle(f)).toBe("Understanding A Function Limit");
    expect(state.user?.credits).toBe(0);
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
          deletionPreparedAt: NOW,
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
    await f.owner.mutation(rename, { chatId: f.chatId, title: DEFAULT_TITLE });
    await f.t.mutation(save, { turnId: f.turnId, title: "Generated title" });
    await f.t.mutation(save, {
      turnId: f.turnId,
      title: "Another generated title",
      suggestions: ["A relevant follow-up?"],
    });
    expect(await readTitle(f)).toBe("Generated title");
    expect(
      (await f.t.query((ctx) => ctx.db.get("chats", f.chatId)))?.title
    ).toBeInstanceOf(ArrayBuffer);
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    ).toMatchObject({ suggestions: ["A relevant follow-up?"] });
  });

  it("saves follow-up suggestions with the turn and the chat read once and the turn read once more to write it", async () => {
    const f = await createNinaTest();
    const metrics = await f.t.mutation(async (ctx) => {
      await ctx.runMutation(save, {
        turnId: f.turnId,
        suggestions: ["A relevant follow-up?"],
      });
      return ctx.meta.getTransactionMetrics();
    });
    // A `patch` of the turn read it once more, which made four.
    expect(metrics.documentsRead.used).toBe(3);
  });

  it("saves a generated title with the chat read once more to write it", async () => {
    const f = await createNinaTest();
    const metrics = await f.t.mutation(async (ctx) => {
      await ctx.runMutation(save, { turnId: f.turnId, title: "Generated" });
      return ctx.meta.getTransactionMetrics();
    });
    // The turn, the chat, the learner's key, and the chat again to write it. A
    // `patch` of the chat read it once more, which made five.
    expect(metrics.documentsRead.used).toBe(4);
  });

  it("keeps a title the learner chose before the generated one arrives", async () => {
    const f = await createNinaTest();
    await f.owner.mutation(rename, { chatId: f.chatId, title: "My own title" });
    await f.t.mutation(save, { turnId: f.turnId, title: "Generated title" });
    expect(await readTitle(f)).toBe("My own title");
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
