import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { MAX_CREDITS_PER_RESPONSE } from "@repo/backend/confect/credits/constants";
import {
  debitLot,
  drawLots,
  readSpendableLots,
  restoreLot,
} from "@repo/backend/confect/credits/lots";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/confect/credits/state";
import {
  NinaCreditError,
  type NinaCreditHold,
} from "@repo/backend/confect/nina/credits/schema";
import { Array as Arr, Clock, Effect, Struct } from "effect";

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

/** The first usage row of a hold, which is the hold's transaction. A hold always draws at least one credit. */
const firstUsage = Effect.fn("nina.credits.firstUsage")(function* (
  usages: readonly Docs["creditTransactions"]["_id"][]
) {
  return yield* Effect.fromOption(Arr.head(usages)).pipe(Effect.orDie);
});

/**
 * Atomically holds credits before provider work, using the SDK's transaction.
 * The allowance of the current period is spent first, because it ends with the
 * period. Then the top-up packs are spent, soonest expiry first. Each source
 * that gives credits writes its own usage row.
 */
export const reserveCredits = Effect.fn("nina.credits.reserve")(
  function* (user: Docs["users"]) {
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
    const lots = yield* readSpendableLots(user._id, now);
    const allowance = Math.max(0, state.credits);
    const available =
      allowance + Arr.reduce(lots, 0, (total, lot) => total + lot.remaining);
    // A turn holds the cap, or the whole balance when that is less. Its real cost settles at the end.
    const hold = Math.min(MAX_CREDITS_PER_RESPONSE, available);
    if (hold < 1) {
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
    const fromAllowance = Math.min(hold, allowance);
    const draws = drawLots(lots, hold - fromAllowance);
    const balance = state.credits - fromAllowance;
    yield* database
      .table("users")
      .patch(user._id, {
        credits: balance,
        creditsResetAt: state.creditsResetAt,
      })
      .pipe(Effect.orDie);
    const allowanceUsage =
      fromAllowance > 0
        ? [
            yield* database
              .table("creditTransactions")
              .insert({
                userId: user._id,
                amount: -fromAllowance,
                type: "usage",
                balanceAfter: balance,
                metadata: {
                  phase: "reserved",
                },
              })
              .pipe(Effect.orDie),
          ]
        : [];
    const lotUsage = yield* Effect.forEach(draws, (draw) =>
      debitLot(draw.lot, draw.credits, { phase: "reserved" })
    );
    const transactionId = yield* firstUsage([...allowanceUsage, ...lotUsage]);
    return {
      userId: user._id,
      credits: hold,
      creditsResetAt: state.creditsResetAt,
      transactionId,
      lots: Arr.map(draws, (draw) => ({
        lotId: draw.lot._id,
        credits: draw.credits,
      })),
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

/**
 * Gives the top-up packs of a hold their credits back, the last drawn first,
 * and returns how many credits the packs took. The charge came off the
 * allowance first, so the packs refund first, which keeps the allowance spent
 * as the charge. A pack that ended keeps nothing back, so its share is lost.
 */
const restoreLotDraws = Effect.fn("nina.credits.restoreLots")(function* (
  draws: NonNullable<typeof NinaCreditHold.Type.lots>,
  refund: number,
  reservationId: string,
  now: number
) {
  const [, restores] = Arr.mapAccum(
    Arr.reverse(draws),
    refund,
    (left, draw) => {
      const credits = Math.min(left, draw.credits);
      return [left - credits, { lotId: draw.lotId, credits }];
    }
  );
  yield* Effect.forEach(
    Arr.filter(restores, (restore) => restore.credits > 0),
    (restore) => restoreLot(restore, reservationId, now),
    { discard: true }
  );
  return Arr.reduce(restores, 0, (total, restore) => total + restore.credits);
});

/**
 * Gives back `refund` credits of a turn's hold, at most once, within its credit
 * period. A turn that answers keeps what its real cost charged, so it refunds the
 * rest; a turn that does not answer refunds all of its hold. The packs the hold
 * drew from take their share back first, and the allowance takes the rest.
 */
export const refundCredits = Effect.fn("nina.credits.refund")(
  function* (
    turn: typeof NinaCreditHold.Type,
    reservationId: string,
    refund: number
  ) {
    if (refund <= 0) {
      return;
    }
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
      const restoredToLots = yield* restoreLotDraws(
        turn.lots ?? [],
        refund,
        reservationId,
        now
      );
      const allowanceRefund = refund - restoredToLots;
      if (allowanceRefund <= 0) {
        return;
      }
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
          ? allowanceRefund
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
