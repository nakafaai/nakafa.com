import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import spec from "@repo/backend/confect/tryouts/mutations/attempts.spec";
import { startTryoutAttempt } from "@repo/backend/confect/tryouts/start/impl";
import { Clock, Effect, Layer } from "effect";

/** Starts one bounded try-out attempt from synced section and question rows. */
const startAttempt = FunctionImpl.make(
  databaseSchema,
  spec,
  "startAttempt",
  Effect.fn("tryouts.mutations.attempts.startAttempt")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth(ctx);
      const now = yield* Clock.currentTimeMillis;
      return yield* startTryoutAttempt(ctx, {
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
  GroupImpl.finalize
);
