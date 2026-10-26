import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  enqueuePassReminder,
  readPassReminderInput,
} from "@repo/backend/confect/billing/reminder/internal";
import spec from "@repo/backend/confect/billing/reminder/internal.spec";
import { Effect, Layer } from "effect";

const readInput = FunctionImpl.make(
  databaseSchema,
  spec,
  "readInput",
  Effect.fn("billing.reminder.internal.readInput")(function* (args) {
    return yield* readPassReminderInput(args.grantId, args.locale);
  })
);

const enqueue = FunctionImpl.make(
  databaseSchema,
  spec,
  "enqueue",
  Effect.fn("billing.reminder.internal.enqueue")(function* ({
    grantId,
    ...message
  }) {
    return yield* enqueuePassReminder(grantId, message);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readInput),
  Layer.provide(enqueue),
  GroupImpl.finalize
);
