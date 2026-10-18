import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  closeDue,
  closeOneAttempt,
  openSitting,
  submitAttempt,
} from "@repo/backend/confect/exams/sittings/closing";
import timers from "@repo/backend/confect/exams/sittings/timers.spec";
import { Effect, Layer } from "effect";

const openFunction = FunctionImpl.make(
  databaseSchema,
  timers,
  "open",
  Effect.fn("exams.sittings.timers.open.function")(function* (args) {
    return yield* openSitting(args.sittingId);
  })
);

const closeDueFunction = FunctionImpl.make(
  databaseSchema,
  timers,
  "closeDue",
  Effect.fn("exams.sittings.timers.closeDue.function")(function* (args) {
    return yield* closeDue(args);
  })
);

const closeAttemptFunction = FunctionImpl.make(
  databaseSchema,
  timers,
  "closeAttempt",
  Effect.fn("exams.sittings.timers.closeAttempt.function")(function* (args) {
    return yield* closeOneAttempt(args);
  })
);

const submitFunction = FunctionImpl.make(
  databaseSchema,
  timers,
  "submit",
  Effect.fn("exams.sittings.timers.submit.function")(function* (args) {
    return yield* submitAttempt(args);
  })
);

/** Implements the scheduled steps of a sitting, which only the scheduler calls. */
export default GroupImpl.make(databaseSchema, timers).pipe(
  Layer.provide(openFunction),
  Layer.provide(closeDueFunction),
  Layer.provide(closeAttemptFunction),
  Layer.provide(submitFunction),
  GroupImpl.finalize
);
