import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { ModelIdSchema } from "@repo/ai/config/model";
import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  readChatTurn,
  refundChatTurn,
  reserveChatTurn,
} from "@repo/backend/convex/chats/turns/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { FunctionArgs } from "convex/server";

const NOW = Date.UTC(2026, 8, 19, 12);

async function fixture(credits = 2, creditsResetAt = NOW) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits, creditsResetAt })
  );
  const authed = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const chatId = await authed.mutation(api.chats.mutations.createChat, {
    type: "study",
  });
  return { t, identity, authed, chatId };
}

describe("chat turn credit admission", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("admits only the request that can pay before either response completes", async () => {
    const { t, authed, identity } = await fixture();
    const results = await Promise.allSettled([
      authed.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-lite",
      }),
      authed.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-lite",
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected")
    ).toMatchObject({ reason: { data: { code: "INSUFFICIENT_CREDITS" } } });
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      turns: await ctx.db.query("chatTurns").collect(),
    }));
    expect(state.user?.credits).toBe(0);
    expect(state.turns).toHaveLength(1);
  });

  it("materializes the reset grant before reserving and refunds exactly once", async () => {
    const { t, authed, identity } = await fixture(0, NOW - 86_400_000);
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-pro",
    });
    await authed.mutation(api.chats.turns.mutations.release, { turnId });
    await authed.mutation(api.chats.turns.mutations.release, { turnId });
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(state.user?.credits).toBe(10);
    expect(state.ledger.map(({ type, amount }) => [type, amount])).toEqual([
      ["daily-grant", 10],
      ["usage", -5],
      ["refund", 5],
    ]);
  });

  it("cannot enlarge the next period with yesterday's refunded hold", async () => {
    const { t, authed, identity } = await fixture();
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    vi.setSystemTime(NOW + 86_400_000);
    await t.mutation(internal.chats.turns.mutations.expire, { turnId });
    await t.mutation(internal.chats.turns.mutations.expire, { turnId });
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(state.user?.credits).toBe(10);
    expect(state.ledger.at(-1)).toMatchObject({ type: "refund", amount: 0 });
  });

  it("settles a held response only once without a second charge", async () => {
    const { t, authed, identity, chatId } = await fixture();
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    const args = {
      userId: identity.userId,
      turnId,
      message: {
        chatId,
        identifier: "answer",
        role: "assistant" as const,
        modelId: "nakafa-lite" as const,
      },
      parts: [],
    };
    const saved = await t.mutation(
      internal.chats.assistantResponses.saveAssistantResponse,
      args
    );
    expect(saved).toMatchObject({ credits: 2, newBalance: 0 });
    expect(
      await t.mutation(
        internal.chats.assistantResponses.saveAssistantResponse,
        args
      )
    ).toBeNull();
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
      turns: await ctx.db.query("chatTurns").collect(),
    }));
    expect(state.user?.credits).toBe(0);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]?.metadata).toMatchObject({
      chatId,
      messageId: saved?.messageId,
    });
    expect(state.turns).toEqual([]);
  });

  it("refunds a failed response and ignores retries after the hold closes", async () => {
    const { t, authed, identity, chatId } = await fixture();
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    const args = {
      userId: identity.userId,
      turnId,
      message: {
        chatId,
        identifier: "failed",
        modelId: "nakafa-lite" as const,
        generationErrorCode: chatResponseFailureCode,
      },
    } satisfies FunctionArgs<
      typeof internal.chats.assistantResponses.saveAssistantFailure
    >;
    await t.mutation(
      internal.chats.assistantResponses.saveAssistantFailure,
      args
    );
    expect(
      await t.mutation(
        internal.chats.assistantResponses.saveAssistantFailure,
        args
      )
    ).toBeNull();
    expect(
      (await t.query((ctx) => ctx.db.get("users", identity.userId)))?.credits
    ).toBe(2);
  });

  it("rejects another user's hold and a different model", async () => {
    const { t, authed, identity } = await fixture(10);
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    const other = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "other" })
    );
    await expect(
      t
        .withIdentity({ subject: other.authUserId, sessionId: other.sessionId })
        .mutation(api.chats.turns.mutations.release, { turnId })
    ).rejects.toMatchObject({ data: { code: "CHAT_TURN_FORBIDDEN" } });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          readChatTurn(ctx, turnId, identity.userId, "nakafa-pro")
        )
      )
    ).rejects.toMatchObject({ data: { code: "CHAT_TURN_FORBIDDEN" } });
  });

  it.each(["prepared", "missing"])(
    "removes %s-account holds without granting credits",
    async (state) => {
      const { t, authed, identity } = await fixture();
      const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-lite",
      });
      await t.mutation(async (ctx) => {
        if (state === "missing") {
          await ctx.db.delete("users", identity.userId);
        } else {
          await ctx.db.patch("users", identity.userId, {
            deletionPreparedAt: NOW,
          });
        }
      });
      await t.mutation(internal.chats.turns.mutations.expire, { turnId });
      expect(
        await t.query((ctx) => ctx.db.get("chatTurns", turnId))
      ).toBeNull();
    }
  );

  it("reports typed failures when the ledger or scheduler cannot persist", async () => {
    const { t, identity } = await fixture();
    await expect(
      t.mutation(async (ctx) => {
        const user = await ctx.db.get("users", identity.userId);
        assert(user);
        vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValueOnce(
          new Error("offline")
        );
        return runConvexProgram(
          reserveChatTurn(ctx, user, ModelIdSchema.make("nakafa-lite"))
        );
      })
    ).rejects.toMatchObject({ data: { code: "CHAT_TURN_IO_FAILED" } });
    expect(
      (await t.query((ctx) => ctx.db.get("users", identity.userId)))?.credits
    ).toBe(2);
  });

  it("reports typed credit-state, hold-read, and refund IO failures", async () => {
    const { t, identity, authed } = await fixture();
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    await expect(
      t.mutation(async (ctx) => {
        const user = await ctx.db.get("users", identity.userId);
        assert(user);
        vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
          throw new Error("offline");
        });
        return runConvexProgram(
          reserveChatTurn(ctx, user, ModelIdSchema.make("nakafa-lite"))
        );
      })
    ).rejects.toMatchObject({ data: { code: "CHAT_TURN_IO_FAILED" } });
    await expect(
      t.mutation((ctx) => {
        vi.spyOn(ctx.db, "get").mockRejectedValueOnce(new Error("offline"));
        return runConvexProgram(
          readChatTurn(ctx, turnId, identity.userId, undefined)
        );
      })
    ).rejects.toMatchObject({ data: { code: "CHAT_TURN_IO_FAILED" } });
    await expect(
      t.mutation(async (ctx) => {
        const turn = await ctx.db.get("chatTurns", turnId);
        assert(turn);
        vi.spyOn(ctx.db, "get").mockRejectedValueOnce(new Error("offline"));
        return runConvexProgram(refundChatTurn(ctx, turn));
      })
    ).rejects.toMatchObject({ data: { code: "CHAT_TURN_IO_FAILED" } });
  });
  it("does not restore admission quota when a hold is refunded", async () => {
    const { authed, t, identity } = await fixture();
    for (let index = 0; index < 5; index += 1) {
      const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-lite",
      });
      await authed.mutation(api.chats.turns.mutations.release, { turnId });
    }
    await expect(
      authed.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-lite",
      })
    ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } });
    expect(
      (await t.query((ctx) => ctx.db.get("users", identity.userId)))?.credits
    ).toBe(2);
  });

  it("settles using the held model even when caller metadata omits it", async () => {
    const { authed, t, identity, chatId } = await fixture();
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    const result = await t.mutation(
      internal.chats.assistantResponses.saveAssistantResponse,
      {
        userId: identity.userId,
        turnId,
        message: { chatId, identifier: "held-model", role: "assistant" },
        parts: [],
      }
    );
    assert(result);
    expect(
      await t.query((ctx) => ctx.db.get("messages", result.messageId))
    ).toMatchObject({ modelId: "nakafa-lite", credits: 2 });
    expect(await t.query((ctx) => ctx.db.get("chatTurns", turnId))).toBeNull();
  });

  it("fails closed when the admission quota component is unavailable", async () => {
    const { t, identity } = await fixture();
    await expect(
      t.mutation(async (ctx) => {
        const user = await ctx.db.get("users", identity.userId);
        assert(user);
        vi.spyOn(ctx, "runMutation").mockRejectedValueOnce(
          new Error("offline")
        );
        return runConvexProgram(
          reserveChatTurn(ctx, user, ModelIdSchema.make("nakafa-lite"))
        );
      })
    ).rejects.toMatchObject({ data: { code: "CHAT_TURN_IO_FAILED" } });
  });
  it.each([false, true])(
    "does not refund across plan replacement (round trip %s)",
    async (roundTrip) => {
      const boundary = Date.UTC(2026, 8, 1);
      vi.setSystemTime(boundary);
      const t = createConvexTestWithBetterAuth();
      const identity = await t.mutation(async (ctx) => {
        const seeded = await seedAuthenticatedUser(ctx, { now: boundary });
        await ctx.db.insert("customers", {
          id: "grant-customer",
          userId: seeded.userId,
          externalId: null,
          metadata: {},
        });
        return seeded;
      });
      const subscription = {
        id: "grant-subscription",
        customerId: "grant-customer",
        createdAt: new Date(boundary).toISOString(),
        modifiedAt: null,
        amount: null,
        currency: null,
        recurringInterval: null,
        status: "active",
        currentPeriodStart: new Date(boundary).toISOString(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        startedAt: new Date(boundary).toISOString(),
        endedAt: null,
        productId: products.pro.id,
        checkoutId: null,
        metadata: {},
      };
      await t.mutation(internal.subscriptions.mutations.createSubscription, {
        subscription,
      });
      const authed = t.withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      });
      const firstGrant = (
        await t.query((ctx) => ctx.db.get("users", identity.userId))
      )?.planCreditGrantId;
      const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-pro",
      });
      await t.mutation(internal.subscriptions.mutations.updateSubscription, {
        subscription: { ...subscription, status: "canceled" },
      });
      if (roundTrip) {
        await t.mutation(internal.subscriptions.mutations.updateSubscription, {
          subscription,
        });
      }
      await authed.mutation(api.chats.turns.mutations.release, { turnId });
      const user = await t.query((ctx) => ctx.db.get("users", identity.userId));
      expect(user?.credits).toBe(roundTrip ? 3000 : 10);
      expect(user?.planCreditGrantId).not.toBe(firstGrant);
    }
  );
});
