import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { setTryoutFlag } from "@repo/backend/confect/tryouts/flag/write";
import spec from "@repo/backend/confect/tryouts/mutations/flags.spec";
import { Clock, Effect, Layer } from "effect";

/** Sets one placement's review flag with server-owned timing and integrity. */
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("tryouts.mutations.flags.set")(function* (args) {
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth();
      const now = yield* Clock.currentTimeMillis;
      return yield* setTryoutFlag({
        args,
        now,
        userId: appUser._id,
      });
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(set),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
