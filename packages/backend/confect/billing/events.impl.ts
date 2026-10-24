import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  cleanupEvents,
  processEvent,
  recordEvent,
} from "@repo/backend/confect/billing/events";
import spec from "@repo/backend/confect/billing/events.spec";
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

const process = FunctionImpl.make(
  databaseSchema,
  spec,
  "process",
  Effect.fn("billing.events.impl.process")(function* (args) {
    yield* processEvent(args.eventId, yield* Clock.currentTimeMillis);
    return null;
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
  Layer.provide(process),
  Layer.provide(cleanup),
  Layer.provide(atomic),
  GroupImpl.finalize
);
