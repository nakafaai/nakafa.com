import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  applyEvent,
  cleanupEvents,
  processEvent,
  recordEvent,
} from "@repo/backend/confect/billing/events";
import spec from "@repo/backend/confect/billing/events.spec";
import {
  listUnprocessedPolar,
  sweepEvents,
} from "@repo/backend/confect/billing/sweep";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, Layer } from "effect";

const record = FunctionImpl.make(
  databaseSchema,
  spec,
  "record",
  Effect.fn("billing.events.impl.record")(function* (args) {
    return yield* recordEvent(args, yield* Clock.currentTimeMillis);
  })
);

const apply = FunctionImpl.make(
  databaseSchema,
  spec,
  "apply",
  Effect.fn("billing.events.impl.apply")(function* (args) {
    return yield* applyEvent(args.eventId, yield* Clock.currentTimeMillis);
  })
);

const process = FunctionImpl.make(
  databaseSchema,
  spec,
  "process",
  Effect.fn("billing.events.impl.process")(function* (args) {
    return yield* processEvent(args.eventId);
  })
);

const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("billing.events.impl.sweep")(function* () {
    return yield* sweepEvents(yield* Clock.currentTimeMillis);
  })
);

const listUnprocessed = FunctionImpl.make(
  databaseSchema,
  spec,
  "listUnprocessed",
  Effect.fn("billing.events.impl.listUnprocessed")(function* (args) {
    return yield* listUnprocessedPolar(args);
  })
);

const cleanup = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanup",
  Effect.fn("billing.events.impl.cleanup")(function* () {
    return yield* cleanupEvents(yield* Clock.currentTimeMillis);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(record),
  Layer.provide(apply),
  Layer.provide(process),
  Layer.provide(sweep),
  Layer.provide(listUnprocessed),
  Layer.provide(cleanup),
  Layer.provide(atomic),
  GroupImpl.finalize
);
