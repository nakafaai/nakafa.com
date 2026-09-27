import { RegisteredConvexFunction } from "@confect/server";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  readChatTurn,
  refundChatTurn,
  reserveChatTurn,
} from "@repo/backend/confect/chats/turns/impl";
import { ModelIdSchema } from "@repo/backend/confect/nina/config/model";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 8, 19, 12);
async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits: 2, creditsResetAt: NOW })
  );
  return {
    t,
    identity,
    authed: t.withIdentity({
      subject: identity.authUserId,
      sessionId: identity.sessionId,
    }),
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("chat credit transaction failures", () => {
  it.each(["ledger", "scheduler"] as const)(
    "reports typed failures when the %s cannot persist",
    async (operation) => {
      const { t, identity } = await fixture();
      await expect(
        t.mutation(async (ctx) => {
          const user = await ctx.db.get("users", identity.userId);
          assert(user);
          if (operation === "scheduler") {
            vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValueOnce(
              new Error("offline")
            );
          } else {
            vi.spyOn(ctx.db, "replace").mockRejectedValueOnce(
              new Error("offline")
            );
          }
          return Effect.runPromise(
            reserveChatTurn(user, ModelIdSchema.make("nakafa-lite")).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          );
        })
      ).rejects.toMatchObject({
        code: "CHAT_TURN_IO_FAILED",
      });
      expect(
        (await t.query((ctx) => ctx.db.get("users", identity.userId)))?.credits
      ).toBe(2);
    }
  );
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
        return Effect.runPromise(
          reserveChatTurn(user, ModelIdSchema.make("nakafa-lite")).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({
      code: "CHAT_TURN_IO_FAILED",
    });
    await expect(
      t.mutation((ctx) => {
        vi.spyOn(ctx.db, "get").mockRejectedValueOnce(new Error("offline"));
        return Effect.runPromise(
          readChatTurn(turnId, identity.userId, undefined).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({
      code: "CHAT_TURN_IO_FAILED",
    });
    await expect(
      t.mutation(async (ctx) => {
        const turn = await ctx.db.get("chatTurns", turnId);
        assert(turn);
        vi.spyOn(ctx.db, "get").mockRejectedValueOnce(new Error("offline"));
        return Effect.runPromise(
          refundChatTurn(turn).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({
      code: "CHAT_TURN_IO_FAILED",
    });
    await expect(
      t.mutation(async (ctx) => {
        const turn = await ctx.db.get("chatTurns", turnId);
        assert(turn);
        vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
          throw new Error("private ledger details");
        });
        return Effect.runPromise(
          refundChatTurn(turn).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({
      code: "CHAT_TURN_IO_FAILED",
    });
    expect(
      await t.query((ctx) => ctx.db.get("chatTurns", turnId))
    ).not.toBeNull();
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
        return Effect.runPromise(
          reserveChatTurn(user, ModelIdSchema.make("nakafa-lite")).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({
      code: "CHAT_TURN_IO_FAILED",
    });
  });
  it("rolls back a refund when its hold cannot be retired", async () => {
    const { t, authed, identity } = await fixture();
    const turnId = await authed.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    await expect(
      t.mutation(async (ctx) => {
        const turn = await ctx.db.get("chatTurns", turnId);
        assert(turn);
        vi.spyOn(ctx.db, "delete").mockRejectedValueOnce(new Error("offline"));
        return Effect.runPromise(
          refundChatTurn(turn).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({ code: "CHAT_TURN_IO_FAILED" });
    expect(
      (await t.query((ctx) => ctx.db.get("users", identity.userId)))?.credits
    ).toBe(0);
    expect(
      await t.query((ctx) => ctx.db.get("chatTurns", turnId))
    ).not.toBeNull();
    expect(
      await t.query((ctx) => ctx.db.query("creditTransactions").collect())
    ).toHaveLength(1);
  });
});
