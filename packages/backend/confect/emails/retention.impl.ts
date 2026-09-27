import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { scheduleRetainedEmailCleanup } from "@repo/backend/confect/emails/retention";
import spec from "@repo/backend/confect/emails/retention.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const cleanupRetainedEmailData = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupRetainedEmailData",
  Effect.fn("emails.retention.cleanupRetainedEmailData")(function* () {
    const ctx = yield* MutationCtxService;
    return yield* scheduleRetainedEmailCleanup(ctx);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupRetainedEmailData),
  Layer.provide(atomic),
  GroupImpl.finalize
);
