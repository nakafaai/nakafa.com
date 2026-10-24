import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { BillingEventDelivery } from "@repo/backend/confect/billing/schema";
import { Effect, Option } from "effect";

/** A webhook row is kept this long, beyond every provider retry window. */
export const BILLING_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** Rows one cleanup run deletes, so a run never reads an unbounded set. */
export const BILLING_EVENT_CLEANUP_BATCH = 100;

export type BillingEventId = Docs["billingEvents"]["_id"];

/** Whether a delivery was stored now, or was already stored by an earlier delivery of the same key. */
export type EventRecorded =
  | { readonly kind: "accepted"; readonly eventId: BillingEventId }
  | { readonly kind: "duplicate"; readonly eventId: BillingEventId };

/**
 * Stores one webhook delivery before anything processes it. A delivery whose
 * key is already stored returns the stored row, so the provider's retries cost
 * nothing and change nothing.
 */
export const recordEvent = Effect.fn("billing.events.record")(function* (
  input: BillingEventDelivery,
  now: number
) {
  const reader = yield* DatabaseReader;
  const existing = yield* reader
    .table("billingEvents")
    .index("by_rail_and_key", (query) =>
      query.eq("rail", input.rail).eq("key", input.key)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(existing)) {
    return {
      kind: "duplicate",
      eventId: existing.value._id,
    } satisfies EventRecorded;
  }
  const writer = yield* DatabaseWriter;
  const eventId = yield* writer
    .table("billingEvents")
    .insert({ ...input, receivedAt: now, processedAt: null })
    .pipe(Effect.orDie);
  return { kind: "accepted", eventId } satisfies EventRecorded;
});

/** Marks a stored delivery as processed. Processing a row twice keeps its first time. */
export const markEventProcessed = Effect.fn("billing.events.markProcessed")(
  function* (eventId: BillingEventId, now: number) {
    const reader = yield* DatabaseReader;
    const event = yield* reader
      .table("billingEvents")
      .get(eventId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (event === null || event.processedAt !== null) {
      return;
    }
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("billingEvents")
      .patch(eventId, { processedAt: now })
      .pipe(Effect.orDie);
  }
);

/**
 * Deletes one batch of webhook rows received before the retention window. Each
 * run reads at most one batch through `by_receivedAt`, so a large backlog is
 * cleared over several runs rather than in one long transaction.
 */
export const cleanupEvents = Effect.fn("billing.events.cleanup")(function* (
  now: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const expired = yield* reader
    .table("billingEvents")
    .index("by_receivedAt", (query) =>
      query.lt("receivedAt", now - BILLING_EVENT_RETENTION_MS)
    )
    .take(BILLING_EVENT_CLEANUP_BATCH)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    expired,
    (event) =>
      writer.table("billingEvents").delete(event._id).pipe(Effect.orDie),
    { discard: true }
  );
  return expired.length;
});
