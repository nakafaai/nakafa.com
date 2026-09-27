import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  getSectionEndReason,
  sectionCompletedResult,
} from "@repo/backend/confect/tryouts/mutations/sections";
import spec from "@repo/backend/confect/tryouts/mutations/sections.spec";
import { finalizeSectionAttempt } from "@repo/backend/confect/tryouts/runtime/finish";
import { requireOwnedAttempt } from "@repo/backend/confect/tryouts/runtime/score";
import {
  requireActiveSectionAttempt,
  startSectionAttempt,
} from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import { Clock, Effect, Layer } from "effect";

const start = FunctionImpl.make(
  databaseSchema,
  spec,
  "start",
  Effect.fn("tryouts.mutations.sections.start")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth(ctx);
      const attempt = yield* requireOwnedAttempt(ctx, {
        attemptId: args.attemptId,
        userId: appUser._id,
      });
      const now = yield* Clock.currentTimeMillis;
      return yield* startSectionAttempt(ctx, {
        attempt,
        now,
        sectionKey: args.sectionKey,
      });
    });
  })
);
const complete = FunctionImpl.make(
  databaseSchema,
  spec,
  "complete",
  Effect.fn("tryouts.mutations.sections.complete")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth(ctx);
      const attempt = yield* requireOwnedAttempt(ctx, {
        attemptId: args.attemptId,
        userId: appUser._id,
      });
      if (attempt.status !== "in-progress") {
        return yield* new TryoutAttemptStateError({
          code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
          message: "Try-out attempt is not active.",
        });
      }
      const now = yield* Clock.currentTimeMillis;
      if (now >= attempt.expiresAt) {
        return yield* new TryoutAttemptStateError({
          code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
          message: "Try-out attempt time has expired.",
        });
      }
      const section = yield* requireActiveSectionAttempt(ctx, {
        attempt,
        sectionKey: args.sectionKey,
      });
      yield* finalizeSectionAttempt(ctx, {
        attempt,
        endReason: getSectionEndReason(section, now),
        now,
        section,
      });
      return sectionCompletedResult;
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(start),
  Layer.provide(complete),
  Layer.provide(atomic),
  GroupImpl.finalize
);
