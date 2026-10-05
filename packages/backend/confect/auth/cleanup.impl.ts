import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { drainDeletedUserDataProgram } from "@repo/backend/confect/auth/cleanup";
import { cleanupDeletedUserProgram } from "@repo/backend/confect/auth/cleanup/impl";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import spec from "@repo/backend/confect/auth/cleanup.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, flow, Layer } from "effect";

const cleanupDeletedUser = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedUser",
  Effect.fn("auth.cleanup.cleanupDeletedUser")(function* (args) {
    return yield* cleanupDeletedUserProgram(args.userId);
  })
);
const drainDeletedUserData = FunctionImpl.make(
  databaseSchema,
  spec,
  "drainDeletedUserData",
  Effect.fn("auth.cleanup.drainDeletedUserData")(function* (args) {
    const { runMutation } = yield* MutationRunner;
    yield* drainDeletedUserDataProgram(
      runMutation(refs.internal.auth.cleanup.cleanupDeletedUser, {
        userId: args.userId,
      }).pipe(
        Effect.mapError(toUserCleanupError),
        Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
      )
    );
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupDeletedUser),
  Layer.provide(drainDeletedUserData),
  Layer.provide(atomic),
  GroupImpl.finalize
);
