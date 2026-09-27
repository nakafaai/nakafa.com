import { FunctionImpl, GroupImpl, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationCtx as MutationCtxService,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  tryUserCleanup,
} from "@repo/backend/confect/auth/cleanup/spec";
import { cancelAccountDeletionAttemptByToken } from "@repo/backend/confect/auth/deletion/attemptCancellation";
import {
  cancelAccountDeletionBatch,
  sweepAccountDeletionCancellationsProgram,
} from "@repo/backend/confect/auth/deletion/cancel";
import { claimAccountDeletion as claimAccountDeletionProgram } from "@repo/backend/confect/auth/deletion/claim";
import { continueAccountDeletionCommitProgram } from "@repo/backend/confect/auth/deletion/commit";
import { ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE } from "@repo/backend/confect/auth/deletion/constants";
import { prepareAccountDeletion as prepareAccountDeletionProgram } from "@repo/backend/confect/auth/deletion/prepare";
import {
  getAccountDeletionAttemptStatusProgram,
  sweepAccountDeletionReceiptsProgram,
} from "@repo/backend/confect/auth/deletion/receipt";
import { AccountDeletionCancellationUnprovenError } from "@repo/backend/confect/auth/deletion/spec";
import spec from "@repo/backend/confect/auth/deletion.spec";
import { authReader } from "@repo/backend/confect/auth/reader";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Duration, Effect, flow, Layer } from "effect";

const claimAccountDeletion = FunctionImpl.make(
  databaseSchema,
  spec,
  "claimAccountDeletion",
  Effect.fn("auth.deletion.claimAccountDeletion")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* claimAccountDeletionProgram(ctx, args.authId, args.attemptId);
  })
);
const continueAccountDeletionCommit = FunctionImpl.make(
  databaseSchema,
  spec,
  "continueAccountDeletionCommit",
  Effect.fn("auth.deletion.continueAccountDeletionCommit")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* continueAccountDeletionCommitProgram(
      ctx,
      args.authId,
      args.expectedPreparation
    );
  })
);
const prepareCurrentAccountDeletion = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepareCurrentAccountDeletion",
  Effect.fn("auth.deletion.prepareCurrentAccountDeletion")(function* (args) {
    const ctx = yield* MutationCtxService;
    const authUser = yield* Effect.promise(async () =>
      authReader.getAuthUser(ctx)
    );
    return yield* prepareAccountDeletionProgram(
      ctx,
      authUser._id,
      args.attemptId
    );
  })
);
const cancelAccountDeletion = FunctionImpl.make(
  databaseSchema,
  spec,
  "cancelAccountDeletion",
  Effect.fn("auth.deletion.cancelAccountDeletion")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* cancelAccountDeletionBatch(
      ctx,
      args.authId,
      args.expectedPreparation
    );
  })
);
const cancelAccountDeletionAttempt = FunctionImpl.make(
  databaseSchema,
  spec,
  "cancelAccountDeletionAttempt",
  Effect.fn("auth.deletion.cancelAccountDeletionAttempt")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* cancelAccountDeletionAttemptByToken(
      ctx,
      args.attemptId,
      (authId) =>
        tryUserCleanup(() => authReader.getAnyUserById(ctx, authId)).pipe(
          Effect.map((user) => user !== null)
        )
    ).pipe(
      Effect.filterOrFail(
        (outcome) => outcome !== null,
        () =>
          new AccountDeletionCancellationUnprovenError({
            code: ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE,
            message: "Account deletion cancellation could not be proven.",
          })
      )
    );
  })
);
const getAccountDeletionAttemptStatus = FunctionImpl.make(
  databaseSchema,
  spec,
  "getAccountDeletionAttemptStatus",
  Effect.fn("auth.deletion.getAccountDeletionAttemptStatus")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* getAccountDeletionAttemptStatusProgram(
      ctx,
      args.attemptId,
      (authId) =>
        tryUserCleanup(() => authReader.getAnyUserById(ctx, authId)).pipe(
          Effect.map((user) => user !== null)
        )
    );
  })
);
const sweepAccountDeletionRetention = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweepAccountDeletionRetention",
  Effect.fn("auth.deletion.sweepAccountDeletionRetention")(function* () {
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const scheduler = yield* Scheduler.Scheduler.pipe(
        Effect.provide(Scheduler.layer(ctx.scheduler))
      );
      const hasMoreCancellations =
        yield* sweepAccountDeletionCancellationsProgram(ctx);
      const hasMoreReceipts = yield* sweepAccountDeletionReceiptsProgram(ctx);
      if (hasMoreCancellations || hasMoreReceipts) {
        yield* scheduler
          .runAfter(
            Duration.millis(0),
            refs.internal.auth.deletion.sweepAccountDeletionRetention,
            {}
          )
          .pipe(Effect.catchDefect(flow(toUserCleanupError, Effect.fail)));
      }
    }).pipe(Effect.as(null));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(claimAccountDeletion),
  Layer.provide(continueAccountDeletionCommit),
  Layer.provide(prepareCurrentAccountDeletion),
  Layer.provide(cancelAccountDeletion),
  Layer.provide(cancelAccountDeletionAttempt),
  Layer.provide(getAccountDeletionAttemptStatus),
  Layer.provide(sweepAccountDeletionRetention),
  Layer.provide(atomic),
  GroupImpl.finalize
);
