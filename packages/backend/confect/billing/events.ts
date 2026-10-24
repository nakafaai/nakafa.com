import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { BillingEventDelivery } from "@repo/backend/confect/billing/schema";
import { BillingRowMissing } from "@repo/backend/confect/billing/spec";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import { Array as Arr, Duration, Effect, Option, Schema } from "effect";

/** A webhook row is kept this long, beyond every provider retry window. */
export const BILLING_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** Rows one cleanup run reads or deletes, so a run never reads an unbounded set. */
const BILLING_EVENT_CLEANUP_BATCH = 100;

type BillingEventId = Docs["billingEvents"]["_id"];

/** Whether a delivery was stored now, or was already stored by an earlier delivery of the same key. */
const EventRecorded = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("accepted"),
    eventId: IdSchema("billingEvents"),
  }),
  Schema.Struct({
    kind: Schema.Literal("duplicate"),
    eventId: IdSchema("billingEvents"),
  }),
]).pipe(Schema.toTaggedUnion("kind"));
type EventRecorded = typeof EventRecorded.Type;

/**
 * Stores one webhook delivery before anything processes it, then schedules its
 * processing. A delivery whose key is already stored returns the stored row, so
 * the provider's retries change nothing, and the processing is scheduled again:
 * processing is idempotent, so a row whose first run failed is retried by the
 * next delivery.
 */
export const recordEvent = Effect.fn("billing.events.record")(function* (
  input: BillingEventDelivery,
  now: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existing = yield* reader
    .table("billingEvents")
    .index("by_rail_and_key", (query) =>
      query.eq("rail", input.rail).eq("key", input.key)
    )
    .first()
    .pipe(Effect.orDie);
  let recorded: EventRecorded;
  if (Option.isSome(existing)) {
    recorded = { kind: "duplicate", eventId: existing.value._id };
  } else {
    const eventId = yield* writer
      .table("billingEvents")
      .insert({ ...input, receivedAt: now, processedAt: null })
      .pipe(Effect.orDie);
    recorded = { kind: "accepted", eventId };
  }
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.billing.events.process,
    { eventId: recorded.eventId }
  );
  return recorded;
});

/**
 * Applies one stored delivery and marks it processed. A row already processed
 * changes nothing. The provider's own event decides what it changes, and an event
 * Nakafa cannot read or does not act on is logged and marked processed too, so it
 * never blocks the rows behind it. Only a row that vanished fails.
 */
export const processEvent = Effect.fn("billing.events.process")(function* (
  eventId: BillingEventId,
  now: number
) {
  const reader = yield* DatabaseReader;
  const event = yield* reader
    .table("billingEvents")
    .get(eventId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (event === null) {
    return yield* new BillingRowMissing({
      table: "billingEvents",
      message: `Webhook ${eventId} is gone.`,
    });
  }
  if (event.processedAt !== null) {
    return;
  }
  const outcome =
    event.rail === "xendit"
      ? yield* processXenditEvent(event.payload)
      : "ignored";
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("billingEvents")
    .patch(eventId, { processedAt: now })
    .pipe(Effect.orDie);
  const detail = { rail: event.rail, type: event.type, outcome };
  if (outcome === "invalid" || outcome === "railMismatch") {
    yield* Effect.logError("Billing webhook was not applied", detail);
  } else {
    yield* Effect.logInfo("Billing webhook processed", detail);
  }
});

/**
 * Deletes one batch of processed webhook rows received before the retention
 * window. An unprocessed row is never deleted: one older than the window has
 * outlived every provider retry, so it is logged for an operator to reconcile.
 * Each run reads at most one batch per query, so a large backlog is cleared over
 * several runs rather than in one long transaction.
 */
export const cleanupEvents = Effect.fn("billing.events.cleanup")(function* (
  now: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const cutoff = now - BILLING_EVENT_RETENTION_MS;
  const processed = yield* reader
    .table("billingEvents")
    .index("by_processedAt", (query) =>
      query.gte("processedAt", 0).lt("processedAt", cutoff)
    )
    .take(BILLING_EVENT_CLEANUP_BATCH)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    processed,
    (event) =>
      writer.table("billingEvents").delete(event._id).pipe(Effect.orDie),
    { discard: true }
  );
  const received = yield* reader
    .table("billingEvents")
    .index("by_receivedAt", (query) => query.lt("receivedAt", cutoff))
    .take(BILLING_EVENT_CLEANUP_BATCH)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    Arr.filter(received, (event) => event.processedAt === null),
    (event) =>
      Effect.logError("Billing webhook stayed unprocessed past retention", {
        rail: event.rail,
        type: event.type,
        receivedAt: event.receivedAt,
      }),
    { discard: true }
  );
  return processed.length;
});
