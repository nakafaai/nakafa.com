import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { markPersonRead } from "@repo/backend/confect/notifications/read";
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

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
