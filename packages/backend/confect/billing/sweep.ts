import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { Array as Arr, Effect, Exit } from "effect";

/** How often the sweep runs, in minutes. The cron reads this, and so do the sweep's windows. */
export const BILLING_EVENT_SWEEP_INTERVAL_MINUTES = 5;
const BILLING_EVENT_SWEEP_INTERVAL_MS =
  BILLING_EVENT_SWEEP_INTERVAL_MINUTES * 60 * 1000;
/** A delivery younger than this may still be in its scheduled run, so the sweep leaves it alone. */
const BILLING_EVENT_SWEEP_MIN_AGE_MS = BILLING_EVENT_SWEEP_INTERVAL_MS;
/** A delivery older than this has outlived every provider retry, so the sweep gives it up. */
const BILLING_EVENT_SWEEP_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Deliveries one sweep run reads, so a run never reads an unbounded set. */
const BILLING_EVENT_SWEEP_BATCH = 50;

/** The Polar deliveries still unprocessed that were received in [receivedFrom, receivedBefore), oldest first. */
export const listUnprocessedPolar = Effect.fn("billing.events.listUnprocessed")(
  function* (input: {
    readonly receivedFrom: number;
    readonly receivedBefore: number;
    readonly limit: number;
  }) {
    const reader = yield* DatabaseReader;
    const rows = yield* reader
      .table("billingEvents")
      .index("by_rail_and_processedAt_and_receivedAt", (query) =>
        query
          .eq("rail", "polar")
          .eq("processedAt", null)
          .gte("receivedAt", input.receivedFrom)
          .lt("receivedAt", input.receivedBefore)
      )
      .take(input.limit)
      .pipe(Effect.orDie);
    return Arr.map(rows, (row) => ({
      eventId: row._id,
      key: row.key,
      receivedAt: row.receivedAt,
      type: row.type,
    }));
  }
);

/**
 * Reapplies the Polar deliveries that stayed unprocessed past the minimum age and
 * within the maximum age, oldest first, one delivery at a time, so a failing one never
 * blocks the rest. A delivery that crosses the maximum age in this interval is logged
 * at error level, once, and is not reapplied. The sweep calls no provider: a customer
 * Nakafa cannot yet link stays unprocessed. Returns how many deliveries it reapplied.
 */
export const sweepEvents = Effect.fn("billing.events.sweep")(function* (
  now: number
) {
  const { runQuery } = yield* QueryRunner;
  const { runMutation } = yield* MutationRunner;
  const due = yield* runQuery(refs.internal.billing.events.listUnprocessed, {
    receivedFrom: now - BILLING_EVENT_SWEEP_MAX_AGE_MS,
    receivedBefore: now - BILLING_EVENT_SWEEP_MIN_AGE_MS,
    limit: BILLING_EVENT_SWEEP_BATCH,
  }).pipe(Effect.orDie);
  for (const event of due) {
    const exit = yield* Effect.exit(
      runMutation(refs.internal.billing.events.apply, {
        eventId: event.eventId,
      })
    );
    if (Exit.isFailure(exit)) {
      yield* Effect.logError(
        "Billing webhook sweep could not apply a delivery",
        {
          key: event.key,
          type: event.type,
        }
      );
    }
  }
  const givenUp = yield* runQuery(
    refs.internal.billing.events.listUnprocessed,
    {
      receivedFrom:
        now - BILLING_EVENT_SWEEP_MAX_AGE_MS - BILLING_EVENT_SWEEP_INTERVAL_MS,
      receivedBefore: now - BILLING_EVENT_SWEEP_MAX_AGE_MS,
      limit: BILLING_EVENT_SWEEP_BATCH,
    }
  ).pipe(Effect.orDie);
  for (const event of givenUp) {
    yield* Effect.logError("Billing webhook gave up after the sweep window", {
      key: event.key,
      receivedAt: event.receivedAt,
      type: event.type,
    });
  }
  return due.length;
});
