import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/tryouts/queries/attempt.spec";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import { Effect, Layer } from "effect";

/** Reports whether one exact owned attempt must lock the app shell. */
const isLockedByAttemptId = FunctionImpl.make(
  databaseSchema,
  spec,
  "isLockedByAttemptId",
  Effect.fn("tryouts.queries.attempt.isLockedByAttemptId")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* Effect.gen(function* () {
      const attemptId = ctx.db.normalizeId("tryoutAttempts", args.attemptId);
      if (!attemptId) {
        return false;
      }
      const auth = yield* getOptionalAppUserForRead(ctx);
      if (!auth) {
        return false;
      }
      const attempt = yield* readOwnedAttemptById(
        ctx,
        attemptId,
        auth.appUser._id
      );
      return attempt?.status === "in-progress";
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(isLockedByAttemptId),
  GroupImpl.finalize
);
