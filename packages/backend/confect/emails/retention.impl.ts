import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { scheduleRetainedEmailCleanup } from "@repo/backend/confect/emails/retention";
import spec from "@repo/backend/confect/emails/retention.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const cleanupRetainedEmailData = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupRetainedEmailData",
  Effect.fn("emails.retention.cleanupRetainedEmailData")(function* () {
    return yield* scheduleRetainedEmailCleanup();
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupRetainedEmailData),
  Layer.provide(atomic),
  GroupImpl.finalize
);
