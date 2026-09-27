import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  CHAT_TURN_EXPIRY_MS,
  ChatTurnError,
  type chatTurnValidator,
} from "@repo/backend/confect/chats/turns/spec";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/confect/credits/state";
import {
  getModelCreditCost,
  type ModelId,
} from "@repo/backend/confect/nina/config/model";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Clock, Duration, Effect, type Schema, Struct } from "effect";

// Admission quota is independent of refundable credits. Five starts may burst;
// ten per minute permits interactive retries without unbounded hold cycling.
const chatRateLimiter = new RateLimiter(components.agentRateLimiter, {
  chatTurn: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 5,
  },
});

/** Atomically hold credits before provider work, using the SDK's transaction. */
export const reserveChatCredits = Effect.fn("chats.credits.reserve")(
  function* (user: Docs["users"], modelId: ModelId) {
    const ctx = yield* MutationCtxService;
    const now = yield* Clock.currentTimeMillis;
    const state = yield* resolveEffectiveCreditState(user, now).pipe(
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
      try: () =>
        chatRateLimiter.limit(ctx, "chatTurn", {
          key: user._id,
        }),
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
    const database = yield* DatabaseWriter;
    const resetGrant = getCreditResetGrantTransaction(user, state);
    if (resetGrant) {
      yield* database
        .table("creditTransactions")
        .insert({
          userId: user._id,
          ...resetGrant,
        })
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
        metadata: {
          modelId,
          phase: "reserved",
        },
      })
      .pipe(Effect.orDie);
    return {
      userId: user._id,
      modelId,
      credits,
      creditsResetAt: state.creditsResetAt,
      transactionId,
      ...Struct.pick(user, ["planCreditGrantId"]),
    };
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

/** Holds credit for the deployed HTTP caller until its rollout retires. */
export const reserveChatTurn = Effect.fn("chats.turns.reserve")(
  function* (user: Docs["users"], modelId: ModelId) {
    const reservation = yield* reserveChatCredits(user, modelId);
    const database = yield* DatabaseWriter;
    const turnId = yield* database
      .table("chatTurns")
      .insert(reservation)
      .pipe(Effect.orDie);
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(
      Duration.millis(CHAT_TURN_EXPIRY_MS),
      refs.internal.chats.turns.mutations.expire,
      { turnId }
    );
    return turnId;
  },
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
    turnId: Id<"chatTurns">,
    userId: Id<"users">,
    modelId: string | undefined
  ) {
    const turn = yield* (yield* DatabaseReader)
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
export const refundChatCredits = Effect.fn("chats.credits.refund")(
  function* (
    turn: Schema.Schema.Type<typeof chatTurnValidator>,
    reservationId: string
  ) {
    const now = yield* Clock.currentTimeMillis;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* reader
      .table("users")
      .get(turn.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (user && !isAccountDeletionPending(user)) {
      const state = yield* resolveEffectiveCreditState(user, now).pipe(
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
          .insert({
            userId: user._id,
            ...resetGrant,
          })
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
          metadata: {
            modelId: turn.modelId,
            reservationId,
          },
        })
        .pipe(Effect.orDie);
    }
  },
  Effect.catchDefect(
    () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to release chat credits.",
      })
  )
);

/** Retires the deployed HTTP reservation after its refundable ledger write. */
export const refundChatTurn = Effect.fn("chats.turns.refund")(
  function* (turn: Docs["chatTurns"]) {
    yield* refundChatCredits(turn, turn._id);
    yield* (yield* DatabaseWriter).table("chatTurns").delete(turn._id);
  },
  Effect.catchDefect(
    () =>
      new ChatTurnError({
        code: "CHAT_TURN_IO_FAILED",
        message: "Unable to release chat credits.",
      })
  )
);
