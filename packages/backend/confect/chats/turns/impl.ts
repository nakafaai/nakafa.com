import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { getModelCreditCost, type ModelId } from "@repo/ai/config/model";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  CHAT_TURN_EXPIRY_MS,
  ChatTurnError,
} from "@repo/backend/confect/chats/turns/spec";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/confect/credits/state";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, Struct } from "effect";

// Admission quota is independent of refundable credits. Five starts may burst;
// ten per minute permits interactive retries without unbounded hold cycling.
const chatRateLimiter = new RateLimiter(components.agentRateLimiter, {
  chatTurn: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 5 },
});

/** Atomically hold credits before provider work, using the SDK's transaction. */
export const reserveChatTurn = Effect.fn("chats.turns.reserve")(
  function* (ctx: MutationCtx, user: Doc<"users">, modelId: ModelId) {
    const now = yield* Clock.currentTimeMillis;
    const state = yield* resolveEffectiveCreditState(ctx.db, user, now).pipe(
      Effect.mapError(
        () =>
          new ChatTurnError({
            code: "CHAT_TURN_IO_FAILED",
            message: "Unable to resolve chat credits.",
          })
      )
    );
    const credits = getModelCreditCost(modelId);
    if (state.credits < credits) {
      return yield* new ChatTurnError({
        code: "INSUFFICIENT_CREDITS",
        message: "Not enough credits to start this response.",
      });
    }
    // The component SDK owns its quota algorithm and component mutation contract.
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
    const database = DatabaseWriter.make(databaseSchema, ctx.db);
    const resetGrant = getCreditResetGrantTransaction(user, state);
    if (resetGrant) {
      yield* database
        .table("creditTransactions")
        .insert({ userId: user._id, ...resetGrant })
        .pipe(Effect.orDie);
    }
    const balance = state.credits - credits;
    yield* database
      .table("users")
      .patch(user._id, {
        credits: balance,
        creditsResetAt: state.creditsResetAt,
      })
      .pipe(Effect.orDie);
    const transactionId = yield* database
      .table("creditTransactions")
      .insert({
        userId: user._id,
        amount: -credits,
        type: "usage",
        balanceAfter: balance,
        metadata: { modelId, phase: "reserved" },
      })
      .pipe(Effect.orDie);
    const turnId = yield* database
      .table("chatTurns")
      .insert({
        userId: user._id,
        modelId,
        credits,
        creditsResetAt: state.creditsResetAt,
        transactionId,
        ...Struct.pick(user, ["planCreditGrantId"]),
      })
      .pipe(Effect.orDie);
    yield* Effect.gen(function* () {
      const scheduler = yield* Scheduler.Scheduler;
      yield* scheduler.runAfter(
        Duration.millis(CHAT_TURN_EXPIRY_MS),
        refs.internal.chats.turns.mutations.expire,
        { turnId }
      );
    }).pipe(Effect.provide(Scheduler.layer(ctx.scheduler)));
    return turnId;
  },
  // Translate native storage defects at this ledger boundary without catching
  // expected insufficient-credit, quota, or ownership failures.
  Effect.catchDefect(
    () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to reserve chat credits.",
      })
  )
);

/** Resolve an unguessable hold once; browsers cannot enumerate reservations. */
export const readChatTurn = Effect.fn("chats.turns.read")(
  function* (
    ctx: MutationCtx,
    turnId: Id<"chatTurns">,
    userId: Id<"users">,
    modelId: string | undefined
  ) {
    const turn = yield* DatabaseReader.make(databaseSchema, ctx.db)
      .table("chatTurns")
      .get(turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
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
  },
  Effect.catchDefect(
    () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to read the chat credit hold.",
      })
  )
);

/** Refund a failed or abandoned turn at most once, within its credit period. */
export const refundChatTurn = Effect.fn("chats.turns.refund")(
  function* (ctx: MutationCtx, turn: Doc<"chatTurns">) {
    const now = yield* Clock.currentTimeMillis;
    const reader = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const user = yield* reader
      .table("users")
      .get(turn.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (user && !isAccountDeletionPending(user)) {
      const state = yield* resolveEffectiveCreditState(ctx.db, user, now).pipe(
        Effect.mapError(
          () =>
            new ChatTurnError({
              code: "CHAT_TURN_IO_FAILED",
              message: "Unable to release chat credits.",
            })
        )
      );
      const resetGrant = getCreditResetGrantTransaction(user, state);
      if (resetGrant) {
        yield* writer
          .table("creditTransactions")
          .insert({ userId: user._id, ...resetGrant })
          .pipe(Effect.orDie);
      }
      // An earlier grant must not enlarge a replacement credit allowance.
      const credits =
        state.creditsResetAt === turn.creditsResetAt &&
        user.planCreditGrantId === turn.planCreditGrantId
          ? turn.credits
          : 0;
      const balance = state.credits + credits;
      yield* writer
        .table("users")
        .patch(user._id, {
          credits: balance,
          creditsResetAt: state.creditsResetAt,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("creditTransactions")
        .insert({
          userId: user._id,
          amount: credits,
          type: "refund",
          balanceAfter: balance,
          metadata: { modelId: turn.modelId, reservationId: turn._id },
        })
        .pipe(Effect.orDie);
    }
    yield* writer.table("chatTurns").delete(turn._id);
  },
  Effect.catchDefect(
    () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to release chat credits.",
      })
  )
);
