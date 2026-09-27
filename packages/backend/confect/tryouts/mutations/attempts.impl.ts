import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tryouts/mutations/attempts.spec";
import { startTryoutAttempt } from "@repo/backend/confect/tryouts/start/impl";
import { Clock, Effect, Layer } from "effect";

/** Starts one bounded try-out attempt from synced section and question rows. */
const startAttempt = FunctionImpl.make(
  databaseSchema,
  spec,
  "startAttempt",
  Effect.fn("tryouts.mutations.attempts.startAttempt")(function* (args) {
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth();
      const now = yield* Clock.currentTimeMillis;
      return yield* startTryoutAttempt({
        args,
        now,
        userId: appUser._id,
      });
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(startAttempt),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
