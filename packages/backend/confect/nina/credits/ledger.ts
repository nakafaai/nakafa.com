import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/confect/credits/state";
import type { ModelId, ModelKey } from "@repo/backend/confect/gateway/model";
import {
  NinaCreditError,
  type NinaCreditHold,
} from "@repo/backend/confect/nina/credits/schema";
import { Clock, Effect, type Schema, Struct } from "effect";

/** Credits one Nina response holds and charges, by model. */
const responseCredits = {
  "nakafa-lite": 2,
  "nakafa-pro": 5,
} satisfies Record<ModelKey, number>;

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
export const reserveCredits = Effect.fn("nina.credits.reserve")(
  function* (user: Docs["users"], modelId: ModelId) {
    const ctx = yield* MutationCtxService;
    const now = yield* Clock.currentTimeMillis;
    const state = yield* resolveEffectiveCreditState(user, now).pipe(
      Effect.mapError(
        () =>
          new NinaCreditError({
            code: "NINA_CREDIT_IO_FAILED",
            message: "Unable to resolve chat credits.",
          })
      )
    );
    const model: ModelKey = modelId;
    const credits = responseCredits[model];
    if (state.credits < credits) {
      return yield* new NinaCreditError({
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
        new NinaCreditError({
          code: "NINA_CREDIT_IO_FAILED",
          message: "Unable to check chat admission quota.",
        }),
    });
    if (!quota.ok) {
      return yield* new NinaCreditError({
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
      new NinaCreditError({
        code: "NINA_CREDIT_IO_FAILED",
        message: "Unable to reserve chat credits.",
      })
  )
);

/** Refund a failed or abandoned turn at most once, within its credit period. */
export const refundCredits = Effect.fn("nina.credits.refund")(
  function* (
    turn: Schema.Schema.Type<typeof NinaCreditHold>,
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
            new NinaCreditError({
              code: "NINA_CREDIT_IO_FAILED",
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
      new NinaCreditError({
        code: "NINA_CREDIT_IO_FAILED",
        message: "Unable to release chat credits.",
      })
  )
);
