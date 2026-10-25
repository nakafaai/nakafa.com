import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  MAX_CREDIT_LOTS,
  TOP_UP_PACK_CREDITS,
  TOP_UP_VALIDITY_MONTHS,
} from "@repo/backend/confect/credits/constants";
import type {
  CreditLotDraw,
  creditTransactionMetadataValidator,
} from "@repo/backend/confect/credits/schema";
import { Array as Arr, DateTime, Effect, Option, Stream } from "effect";

type CreditLot = Docs["creditLots"];
type CreditLotId = CreditLot["_id"];
type UserId = Docs["users"]["_id"];
type PaymentId = Docs["billingPayments"]["_id"];
type CreditTransactionMetadata = typeof creditTransactionMetadataValidator.Type;

/** A running pack a learner can spend, with the credits it still holds. */
type SpendableLot = CreditLot;

/** The pack with the given ID, or null when it no longer exists. */
const readLot = Effect.fn("credits.lots.read")(function* (lotId: CreditLotId) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("creditLots")
    .get(lotId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/**
 * The packs a learner can spend at `now`, soonest expiry first. Nina spends
 * the allowance first and then these packs in this order. A pack with nothing
 * left is not listed. A spent pack keeps running until it expires, so the stream
 * drops spent packs before it counts toward the cap.
 */
export const readSpendableLots = Effect.fn("credits.lots.readSpendable")(
  function* (userId: UserId, now: number) {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("creditLots")
      .index("by_userId_and_state_and_expiresAt", (query) =>
        query.eq("userId", userId).eq("state", "active").gt("expiresAt", now)
      )
      .stream()
      .pipe(
        Stream.filter((lot) => lot.remaining > 0),
        Stream.take(MAX_CREDIT_LOTS),
        Stream.runCollect,
        Effect.orDie
      );
  }
);

/**
 * Splits `credits` over the packs in the order given: each pack gives what it
 * holds until the credits run out. The packs must come soonest expiry first.
 */
export function drawLots(lots: readonly SpendableLot[], credits: number) {
  const [, draws] = Arr.mapAccum(lots, credits, (needed, lot) => {
    const drawn = Math.min(needed, lot.remaining);
    return [needed - drawn, { lot, credits: drawn }];
  });
  return Arr.filter(draws, (draw) => draw.credits > 0);
}

/**
 * Takes the credits of one hold out of a pack and records the usage. The usage
 * row's `balanceAfter` is what the pack holds after it.
 */
export const debitLot = Effect.fn("credits.lots.debit")(function* (
  lot: SpendableLot,
  credits: number,
  metadata: CreditTransactionMetadata
) {
  const writer = yield* DatabaseWriter;
  const remaining = lot.remaining - credits;
  yield* writer
    .table("creditLots")
    .patch(lot._id, { remaining })
    .pipe(Effect.orDie);
  return yield* writer
    .table("creditTransactions")
    .insert({
      userId: lot.userId,
      amount: -credits,
      type: "usage",
      balanceAfter: remaining,
      metadata: { ...metadata, lotId: lot._id },
    })
    .pipe(Effect.orDie);
});

/**
 * Gives one hold's draw back to its pack. A pack that ended keeps nothing back,
 * because its credits are gone with it, so the draw is lost in that case.
 */
export const restoreLot = Effect.fn("credits.lots.restore")(function* (
  draw: typeof CreditLotDraw.Type,
  reservationId: string,
  now: number
) {
  const lot = yield* readLot(draw.lotId);
  if (lot === null || lot.state !== "active" || lot.expiresAt <= now) {
    return;
  }
  const remaining = lot.remaining + draw.credits;
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("creditLots")
    .patch(lot._id, { remaining })
    .pipe(Effect.orDie);
  yield* writer
    .table("creditTransactions")
    .insert({
      userId: lot.userId,
      amount: draw.credits,
      type: "refund",
      balanceAfter: remaining,
      metadata: { reservationId, lotId: lot._id },
    })
    .pipe(Effect.orDie);
});

/** Ends a running pack: its unused credits leave with one transaction, and the pack keeps no balance. */
const endLot = Effect.fn("credits.lots.end")(function* (
  lot: CreditLot & { readonly _id: CreditLotId },
  state: CreditLot["state"],
  type: "expiration" | "refund",
  reason: string
) {
  const writer = yield* DatabaseWriter;
  if (lot.remaining > 0) {
    yield* writer
      .table("creditTransactions")
      .insert({
        userId: lot.userId,
        amount: -lot.remaining,
        type,
        balanceAfter: 0,
        metadata: { lotId: lot._id, reason },
      })
      .pipe(Effect.orDie);
  }
  yield* writer
    .table("creditLots")
    .patch(lot._id, { remaining: 0, state })
    .pipe(Effect.orDie);
});

/** Ends one pack at its expiry. A pack that is spent, ended, or not yet due changes nothing. */
export const expireLot = Effect.fn("credits.lots.expire")(function* (
  lotId: CreditLotId,
  now: number
) {
  const lot = yield* readLot(lotId);
  if (lot === null || lot.state !== "active" || lot.expiresAt > now) {
    return;
  }
  yield* endLot(lot, "expired", "expiration", "expired");
});

/** The packs of a learner that still run, in one bounded read. */
const readRunningLots = Effect.fn("credits.lots.readRunning")(function* (
  userId: UserId
) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("creditLots")
    .index("by_userId_and_state_and_expiresAt", (query) =>
      query.eq("userId", userId).eq("state", "active")
    )
    .take(MAX_CREDIT_LOTS)
    .pipe(Effect.orDie);
});

/**
 * Ends every running pack of a learner whose Pro grant ended, so the packs are
 * never spent without Pro. Each read takes a bounded batch, and an ended pack
 * leaves the running set, so the next read takes the packs that remain.
 */
export const forfeitLots = Effect.fn("credits.lots.forfeit")(function* (
  userId: UserId
) {
  let lots = yield* readRunningLots(userId);
  while (lots.length > 0) {
    yield* Effect.forEach(
      lots,
      (lot) => endLot(lot, "forfeited", "expiration", "pro-ended"),
      { discard: true }
    );
    lots = yield* readRunningLots(userId);
  }
});

/** Removes the unused credits of the pack a refunded payment bought. The credits already spent stay spent. */
export const refundLotOfPayment = Effect.fn("credits.lots.refundPayment")(
  function* (paymentId: PaymentId) {
    const reader = yield* DatabaseReader;
    const lot = yield* reader
      .table("creditLots")
      .index("by_paymentId", (query) => query.eq("paymentId", paymentId))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(lot) || lot.value.state !== "active") {
      return;
    }
    yield* endLot(lot.value, "refunded", "refund", "order-refunded");
  }
);

/**
 * Grants one top-up pack to a learner: its credits are bought at the payment's
 * time, expire twelve months later, and the expiry is scheduled so the pack
 * writes its last credit change at that moment.
 */
export const grantTopUpLot = Effect.fn("credits.lots.grant")(function* (input: {
  readonly userId: UserId;
  readonly paymentId: PaymentId;
  readonly paidAt: number;
}) {
  const expiresAt = DateTime.toEpochMillis(
    DateTime.add(DateTime.makeUnsafe(input.paidAt), {
      months: TOP_UP_VALIDITY_MONTHS,
    })
  );
  const writer = yield* DatabaseWriter;
  const lotId = yield* writer
    .table("creditLots")
    .insert({
      userId: input.userId,
      paymentId: input.paymentId,
      granted: TOP_UP_PACK_CREDITS,
      remaining: TOP_UP_PACK_CREDITS,
      expiresAt,
      state: "active",
    })
    .pipe(Effect.orDie);
  yield* writer
    .table("creditTransactions")
    .insert({
      userId: input.userId,
      amount: TOP_UP_PACK_CREDITS,
      type: "purchase",
      balanceAfter: TOP_UP_PACK_CREDITS,
      metadata: { lotId, paymentId: input.paymentId },
    })
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAt(
    DateTime.makeUnsafe(expiresAt),
    refs.internal.credits.lots.expire,
    { lotId }
  );
  return lotId;
});
