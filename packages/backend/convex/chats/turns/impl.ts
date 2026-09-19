import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { getModelCreditCost, type ModelId } from "@repo/ai/config/model";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import {
  CHAT_TURN_EXPIRY_MS,
  ChatTurnError,
} from "@repo/backend/convex/chats/turns/spec";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/convex/credits/helpers/state";
import { Clock, Effect } from "effect";

// Admission quota is independent of refundable credits. Five starts may burst;
// ten per minute permits interactive retries without unbounded hold cycling.
const chatRateLimiter = new RateLimiter(components.agentRateLimiter, {
  chatTurn: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 5 },
});

/** Atomically holds credits before any provider work begins. */
export const reserveChatTurn = Effect.fn("ChatTurn.reserve")(function* (
  ctx: MutationCtx,
  user: Doc<"users">,
  modelId: ModelId
) {
  const now = yield* Clock.currentTimeMillis;
  const state = yield* Effect.tryPromise({
    try: () => resolveEffectiveCreditState(ctx.db, user, now),
    catch: () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to resolve chat credits.",
      }),
  });
  const credits = getModelCreditCost(modelId);
  if (state.credits < credits) {
    return yield* new ChatTurnError({
      code: "INSUFFICIENT_CREDITS",
      message: "Not enough credits to start this response.",
    });
  }
  const quota = yield* Effect.tryPromise({
    try: () => chatRateLimiter.limit(ctx, "chatTurn", { key: user._id }),
    catch: () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to check chat admission quota.",
      }),
  });
  if (!quota.ok) {
    return yield* new ChatTurnError({
      code: "RATE_LIMITED",
      message: "Too many chat requests. Try again shortly.",
    });
  }
  return yield* Effect.tryPromise({
    try: async () => {
      const resetGrant = getCreditResetGrantTransaction(user, state);
      if (resetGrant) {
        await ctx.db.insert("creditTransactions", {
          userId: user._id,
          ...resetGrant,
        });
      }
      const balance = state.credits - credits;
      await ctx.db.patch("users", user._id, {
        credits: balance,
        creditsResetAt: state.creditsResetAt,
      });
      const transactionId = await ctx.db.insert("creditTransactions", {
        userId: user._id,
        amount: -credits,
        type: "usage",
        balanceAfter: balance,
        metadata: { modelId, phase: "reserved" },
      });
      const turnId = await ctx.db.insert("chatTurns", {
        userId: user._id,
        modelId,
        credits,
        creditsResetAt: state.creditsResetAt,
        transactionId,
        planCreditGrantId: user.planCreditGrantId,
      });
      await ctx.scheduler.runAfter(
        CHAT_TURN_EXPIRY_MS,
        internal.chats.turns.mutations.expire,
        { turnId }
      );
      return turnId;
    },
    catch: () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to reserve chat credits.",
      }),
  });
});

/** Resolves an unguessable hold once; no reader exposes holds to browsers. */
export const readChatTurn = Effect.fn("ChatTurn.read")(function* (
  ctx: MutationCtx,
  turnId: Id<"chatTurns">,
  userId: Id<"users">,
  modelId: string | undefined
) {
  const turn = yield* Effect.tryPromise({
    try: () => ctx.db.get("chatTurns", turnId),
    catch: () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to read the chat credit hold.",
      }),
  });
  if (
    turn &&
    (turn.userId !== userId ||
      (modelId !== undefined && turn.modelId !== modelId))
  ) {
    return yield* new ChatTurnError({
      code: "CHAT_TURN_FORBIDDEN",
      message: "The chat credit hold does not belong to this response.",
    });
  }
  return turn;
});

/** Refunds a failed or abandoned turn at most once, within its credit period. */
export const refundChatTurn = Effect.fn("ChatTurn.refund")(function* (
  ctx: MutationCtx,
  turn: Doc<"chatTurns">
) {
  const now = yield* Clock.currentTimeMillis;
  yield* Effect.tryPromise({
    try: async () => {
      const user = await ctx.db.get("users", turn.userId);
      if (user && !isAccountDeletionPending(user)) {
        const state = await resolveEffectiveCreditState(ctx.db, user, now);
        const resetGrant = getCreditResetGrantTransaction(user, state);
        if (resetGrant) {
          await ctx.db.insert("creditTransactions", {
            userId: user._id,
            ...resetGrant,
          });
        }
        // A credit from yesterday must not enlarge today's fresh allowance.
        const credits =
          state.creditsResetAt === turn.creditsResetAt &&
          user.planCreditGrantId === turn.planCreditGrantId
            ? turn.credits
            : 0;
        const balance = state.credits + credits;
        await ctx.db.patch("users", user._id, {
          credits: balance,
          creditsResetAt: state.creditsResetAt,
        });
        await ctx.db.insert("creditTransactions", {
          userId: user._id,
          amount: credits,
          type: "refund",
          balanceAfter: balance,
          metadata: { modelId: turn.modelId, reservationId: turn._id },
        });
      }
      await ctx.db.delete("chatTurns", turn._id);
    },
    catch: () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to release chat credits.",
      }),
  });
});
