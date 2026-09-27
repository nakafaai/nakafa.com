import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  MutationRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  tryUserCleanup,
} from "@repo/backend/confect/auth/cleanup/spec";
import {
  recoverAccountDeletionProgram,
  sweepAccountDeletionRecoveryProgram,
} from "@repo/backend/confect/auth/deletion/recovery";
import spec from "@repo/backend/confect/auth/deletion/recovery.spec";
import { authReader } from "@repo/backend/confect/auth/reader";
import { Duration, Effect, flow, Layer } from "effect";

const sweepAccountDeletionRecovery = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweepAccountDeletionRecovery",
  Effect.fn("auth.deletion.recovery.sweepAccountDeletionRecovery")(
    function* () {
      return yield* Effect.gen(function* () {
        const scheduler = yield* Scheduler;
        const hasMore = yield* sweepAccountDeletionRecoveryProgram();
        if (hasMore) {
          yield* scheduler
            .runAfter(
              Duration.millis(0),
              refs.internal.auth.deletion.recovery.sweepAccountDeletionRecovery,
              {}
            )
            .pipe(Effect.catchDefect(flow(toUserCleanupError, Effect.fail)));
        }
      }).pipe(Effect.as(null));
    }
  )
);
const recoverAccountDeletion = FunctionImpl.make(
  databaseSchema,
  spec,
  "recoverAccountDeletion",
  Effect.fn("auth.deletion.recovery.recoverAccountDeletion")(function* (args) {
    const ctx = yield* ActionCtxService;
    const runMutation = yield* MutationRunner;
    yield* recoverAccountDeletionProgram({
      authUserExists: tryUserCleanup(() =>
        authReader.getAnyUserById(ctx, args.authId)
      ).pipe(Effect.map((user) => user !== null)),
      cancel: runMutation(refs.internal.auth.deletion.cancelAccountDeletion, {
        authId: args.authId,
        expectedPreparation: args.expectedPreparation,
      }).pipe(
        Effect.mapError(toUserCleanupError),
        Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
      ),
      continueCommit: runMutation(
        refs.internal.auth.deletion.continueAccountDeletionCommit,
        {
          authId: args.authId,
          expectedPreparation: args.expectedPreparation,
        }
      ).pipe(
        Effect.mapError(toUserCleanupError),
        Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
      ),
      finalize: runMutation(
        refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
        {
          authId: args.authId,
          expectedPreparation: args.expectedPreparation,
        }
      ).pipe(
        Effect.mapError(toUserCleanupError),
        Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
      ),
    }).pipe(
      Effect.annotateLogs({
        authId: args.authId,
      })
    );
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sweepAccountDeletionRecovery),
  Layer.provide(recoverAccountDeletion),
  GroupImpl.finalize
);
