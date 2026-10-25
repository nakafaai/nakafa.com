import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { resolvePolarCustomer } from "@repo/backend/confect/billing/polar/resolve";
import { processPolarEvent } from "@repo/backend/confect/billing/polar/webhook";
import type { BillingEventDelivery } from "@repo/backend/confect/billing/schema";
import { BillingRowMissing } from "@repo/backend/confect/billing/spec";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Predicate,
  Schema,
} from "effect";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A webhook row is kept this long, beyond every provider retry window. */
export const BILLING_EVENT_RETENTION_MS = 90 * DAY_MS;
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

/** Marks one delivery processed, and logs what it did. Invalid bodies and deliveries on the wrong rail are errors. */
const recordOutcome = Effect.fn("billing.events.recordOutcome")(function* (
  eventId: BillingEventId,
  detail: {
    readonly rail: string;
    readonly type: string;
    readonly outcome: string;
  },
  now: number
) {
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("billingEvents")
    .patch(eventId, { processedAt: now })
    .pipe(Effect.orDie);
  if (detail.outcome === "invalid" || detail.outcome === "railMismatch") {
    yield* Effect.logError("Billing webhook was not applied", detail);
  } else {
    yield* Effect.logInfo("Billing webhook processed", detail);
  }
});

/**
 * Applies one stored delivery. A row already processed changes nothing. A Polar
 * delivery naming a customer Nakafa holds no account for is returned as unknown,
 * and stays unprocessed for the caller to resolve. Every other outcome marks the
 * row processed, so an event Nakafa cannot read or does not act on never blocks
 * the rows behind it. A failure leaves the row unprocessed.
 */
export const applyEvent = Effect.fn("billing.events.apply")(function* (
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
    return { kind: "processed" as const };
  }
  if (event.rail === "polar") {
    const outcome = yield* processPolarEvent(event.payload);
    if (!Predicate.isString(outcome)) {
      return {
        kind: "unknownCustomer" as const,
        customerId: outcome.customerId,
      };
    }
    yield* recordOutcome(
      eventId,
      { rail: event.rail, type: event.type, outcome },
      now
    );
    return { kind: "processed" as const };
  }
  const outcome = yield* processXenditEvent(event.payload);
  yield* recordOutcome(
    eventId,
    { rail: event.rail, type: event.type, outcome },
    now
  );
  return { kind: "processed" as const };
});

/**
 * Applies one stored delivery from the scheduler. A Polar customer Nakafa holds no
 * account for is resolved against Polar once, and the delivery is applied again when
 * that links the customer. A delivery whose customer still matches no billable user
 * stays unprocessed, and the sweep reapplies it until it is given up.
 */
export const processEvent = Effect.fn("billing.events.process")(function* (
  eventId: BillingEventId
) {
  const { runMutation } = yield* MutationRunner;
  const applied = yield* runMutation(refs.internal.billing.events.apply, {
    eventId,
  }).pipe(Effect.orDie);
  if (applied.kind === "processed") {
    return null;
  }
  // A Polar read that fails leaves the delivery unprocessed, and the sweep and the reconciliation retry it.
  const resolution = yield* resolvePolarCustomer(applied.customerId).pipe(
    Effect.catchTag("PolarCustomerError", (error) =>
      Effect.logError("Polar customer of a billing webhook could not be read", {
        customerId: applied.customerId,
        message: error.message,
      }).pipe(Effect.as("unresolved" as const))
    )
  );
  if (resolution === "linked") {
    yield* runMutation(refs.internal.billing.events.apply, { eventId }).pipe(
      Effect.orDie
    );
  }
  return null;
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
