import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/notifications/purge.spec";
import { purgeInbox } from "@repo/backend/confect/notifications/purge";
import { Effect, Layer } from "effect";

const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("notifications.purge.run")(function* ({ personId }) {
    yield* purgeInbox(personId);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
