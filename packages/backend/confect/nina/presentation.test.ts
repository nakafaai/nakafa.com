import { Ref } from "@confect/core";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import { createNinaTest, ninaModel } from "@repo/backend/test/nina";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/config/provider", () => ({
  getGatewayModel: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
const run = Ref.getFunctionReference(refs.internal.nina.response.run);
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
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
      await f.t.action(run, { turnId: f.turnId });
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
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
    await f.t.action(run, { turnId: f.turnId });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(
      (await f.t.query((ctx) => ctx.db.get("chats", f.chatId)))?.activeTurnId
    ).toBeUndefined();
    expect(
      (await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId)))?.state
        .status
    ).toBe("complete");
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
    expect(getGatewayModel).not.toHaveBeenCalled();
    expect(
      (await f.t.query((ctx) => ctx.db.get("users", f.identity.userId)))
        ?.credits
    ).toBe(10);
  });
});
