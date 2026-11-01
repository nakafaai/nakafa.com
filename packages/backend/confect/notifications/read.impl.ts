import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  markAccountRead,
  markPersonRead,
} from "@repo/backend/confect/notifications/read";
import spec from "@repo/backend/confect/notifications/read.spec";
import { Effect, Layer } from "effect";

const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("notifications.read.run")(function* ({ cursor, personId, readAt }) {
    yield* markPersonRead(personId, cursor, readAt);
    return null;
  })
);

const runAccount = FunctionImpl.make(
  databaseSchema,
  spec,
  "runAccount",
  Effect.fn("notifications.read.runAccount")(function* ({
    cursor,
    readAt,
    userId,
  }) {
    yield* markAccountRead(userId, cursor, readAt);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  Layer.provide(runAccount),
  GroupImpl.finalize
);
