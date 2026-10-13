import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { tryoutGate } from "@repo/backend/confect/tryouts/gate";
import spec, {
  SECTION_COMPLETED_RESULT,
} from "@repo/backend/confect/tryouts/mutations/sections.spec";
import { requireOwnedAttempt } from "@repo/backend/confect/tryouts/runtime/score";
import { startSectionAttempt } from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import { Clock, Effect, Layer } from "effect";

const start = FunctionImpl.make(
  databaseSchema,
  spec,
  "start",
  Effect.fn("tryouts.mutations.sections.start")(function* (args) {
    const { appUser } = yield* requireAuth();
    const attempt = yield* requireOwnedAttempt({
      attemptId: args.attemptId,
      userId: appUser._id,
    });
    const now = yield* Clock.currentTimeMillis;
    return yield* startSectionAttempt({
      attempt,
      now,
      sectionKey: args.sectionKey,
    });
  })
);

const completed = Object.freeze({ kind: SECTION_COMPLETED_RESULT });

/** Ends and scores the caller's running section through the live-attempt gate. */
const complete = FunctionImpl.make(
  databaseSchema,
  spec,
  "complete",
  Effect.fn("tryouts.mutations.sections.complete")(function* (args) {
    const { appUser } = yield* requireAuth();
    yield* tryoutGate.finish(appUser._id, args);
    return completed;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(start),
  Layer.provide(complete),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
