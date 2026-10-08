import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE,
} from "@repo/backend/confect/auth/deletion/constants";
import {
  RecoveryOperations,
  recoverAccountDeletionProgram,
  sweepAccountDeletionRecoveryProgram,
} from "@repo/backend/confect/auth/deletion/recovery";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 11, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
describe("auth/deletion/recovery", () => {
  it.live("cancels preparation while the auth user still exists", () =>
    Effect.gen(function* () {
      const cancel = vi.fn(() => Effect.succeed(false));
      const finalize = vi.fn(() => Effect.void);
      yield* recoverAccountDeletionProgram().pipe(
        Effect.provideService(RecoveryOperations, {
          authUserExists: Effect.succeed(true),
          cancel: Effect.suspend(cancel),
          continueCommit: Effect.succeed(false),
          finalize: Effect.suspend(finalize),
        })
      );
      expect(cancel).toHaveBeenCalledOnce();
      expect(finalize).not.toHaveBeenCalled();
    })
  );
  it.live("finalizes preparation after the auth user is gone", () =>
    Effect.gen(function* () {
      const cancel = vi.fn(() => Effect.succeed(false));
      const finalize = vi.fn(() => Effect.void);
      yield* recoverAccountDeletionProgram().pipe(
        Effect.provideService(RecoveryOperations, {
          authUserExists: Effect.succeed(false),
          cancel: Effect.suspend(cancel),
          continueCommit: Effect.succeed(false),
          finalize: Effect.suspend(finalize),
        })
      );
      expect(cancel).not.toHaveBeenCalled();
      expect(finalize).toHaveBeenCalledOnce();
    })
  );
  it.live("keeps failed recovery typed for the durable sweep to retry", () =>
    Effect.gen(function* () {
      const failure = yield* recoverAccountDeletionProgram().pipe(
        Effect.provideService(RecoveryOperations, {
          authUserExists: Effect.fail(
            toUserCleanupError(new Error("auth unavailable"))
          ),
          cancel: Effect.succeed(false),
          continueCommit: Effect.succeed(false),
          finalize: Effect.void,
        }),
        Effect.flip
      );
      expect(failure).toMatchObject({
        _tag: "UserCleanupError",
        code: "USER_CLEANUP_FAILED",
        message: "Unable to complete account cleanup.",
        cause: expect.any(Error),
      });
    })
  );
  it.live("delegates exactly one bounded cancellation batch", () =>
    Effect.gen(function* () {
      const cancel = vi.fn(() => Effect.succeed(true));
      yield* recoverAccountDeletionProgram().pipe(
        Effect.provideService(RecoveryOperations, {
          authUserExists: Effect.succeed(true),
          cancel: Effect.suspend(cancel),
          continueCommit: Effect.succeed(false),
          finalize: Effect.void,
        })
      );
      expect(cancel).toHaveBeenCalledOnce();
    })
  );
  it.live("continues a claimed deletion without reopening cancellation", () =>
    Effect.gen(function* () {
      const authUserExists = vi.fn(() => Effect.succeed(true));
      const cancel = vi.fn(() => Effect.succeed(false));
      const continueCommit = vi.fn(() => Effect.succeed(true));
      const finalize = vi.fn(() => Effect.void);
      yield* recoverAccountDeletionProgram().pipe(
        Effect.provideService(RecoveryOperations, {
          authUserExists: Effect.suspend(authUserExists),
          cancel: Effect.suspend(cancel),
          continueCommit: Effect.suspend(continueCommit),
          finalize: Effect.suspend(finalize),
        })
      );
      expect(continueCommit).toHaveBeenCalledOnce();
      expect(authUserExists).not.toHaveBeenCalled();
      expect(cancel).not.toHaveBeenCalled();
      expect(finalize).not.toHaveBeenCalled();
    })
  );
  it.live("claims only due preparations before scheduling recovery", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      vi.setSystemTime(NOW);
      const t = convexTest(schema, convexModules);
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            authId: "due-recovery-owner",
            credits: 0,
            creditsResetAt: 0,
            email: "due-recovery-owner@example.com",
            name: "Due Recovery Owner",
            plan: "free",
          });
          const dueId = await ctx.db.insert("accountDeletionPreparations", {
            attemptId: ATTEMPT_ID,
            authId: "due-recovery-owner",
            recoveryAt: NOW - 1,
            recoveryGeneration: 2,
            userId,
          });
          const futureId = await ctx.db.insert("accountDeletionPreparations", {
            attemptId: "019fa44c-02be-7cd0-a4ed-61a7af8e0621",
            authId: "future-recovery-owner",
            recoveryAt: NOW + 1,
            recoveryGeneration: 0,
            userId,
          });
          return {
            dueId,
            futureId,
          };
        })
      );
      const hasMore = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            sweepAccountDeletionRecoveryProgram().pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          due: await ctx.db.get("accountDeletionPreparations", seeded.dueId),
          future: await ctx.db.get(
            "accountDeletionPreparations",
            seeded.futureId
          ),
        }))
      );
      expect(hasMore).toBe(false);
      expect(state.due).toMatchObject({
        recoveryAt: NOW + ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
        recoveryGeneration: 3,
      });
      expect(state.future).toMatchObject({
        recoveryAt: NOW + 1,
        recoveryGeneration: 0,
      });
      expect(
        yield* Effect.promise(() =>
          t.query(async (ctx) =>
            Arr.filter(
              await ctx.db.system.query("_scheduled_functions").collect(),
              (job) =>
                job.name ===
                Ref.getConvexFunctionName(
                  refs.internal.auth.deletion.recovery.recoverAccountDeletion
                )
            )
          )
        )
      ).toEqual([
        expect.objectContaining({
          args: [
            {
              authId: "due-recovery-owner",
              expectedPreparation: {
                attemptId: ATTEMPT_ID,
                preparationId: seeded.dueId,
                recoveryGeneration: 3,
              },
            },
          ],
          state: {
            kind: "pending",
          },
        }),
      ]);
    })
  );
  it.live("clears an invalid recovery lease without scheduling it", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      vi.setSystemTime(NOW);
      const t = convexTest(schema, convexModules);
      const preparationId = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            authId: "finalized-recovery-owner",
            credits: 0,
            creditsResetAt: 0,
            email: "finalized-recovery-owner@example.com",
            name: "Finalized Recovery Owner",
            plan: "free",
          });
          return ctx.db.insert("accountDeletionPreparations", {
            authId: "finalized-recovery-owner",
            finalizedAt: NOW - 10,
            recoveryAt: NOW - 1,
            recoveryGeneration: 0,
            userId,
          });
        })
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            sweepAccountDeletionRecoveryProgram().pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const preparation = yield* Effect.promise(() =>
        t.query((ctx) =>
          ctx.db.get("accountDeletionPreparations", preparationId)
        )
      );
      expect(preparation).not.toHaveProperty("recoveryAt");
      expect(
        yield* Effect.promise(() =>
          t.query(async (ctx) =>
            Arr.filter(
              await ctx.db.system.query("_scheduled_functions").collect(),
              (job) =>
                job.name ===
                Ref.getConvexFunctionName(
                  refs.internal.auth.deletion.recovery.recoverAccountDeletion
                )
            )
          )
        )
      ).toHaveLength(0);
    })
  );
  it.live("rolls back the lease when scheduling fails", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      vi.setSystemTime(NOW);
      const t = convexTest(schema, convexModules);
      const preparationId = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            authId: "failed-schedule-owner",
            credits: 0,
            creditsResetAt: 0,
            email: "failed-schedule-owner@example.com",
            name: "Failed Schedule Owner",
            plan: "free",
          });
          return ctx.db.insert("accountDeletionPreparations", {
            attemptId: ATTEMPT_ID,
            authId: "failed-schedule-owner",
            recoveryAt: NOW - 1,
            recoveryGeneration: 0,
            userId,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) => {
            vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValueOnce(
              new Error("scheduler unavailable")
            );
            return Effect.runPromiseWith(runtimeServices)(
              sweepAccountDeletionRecoveryProgram().pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            );
          })
        ).rejects.toMatchObject({
          code: "USER_CLEANUP_FAILED",
          message: "Unable to complete account cleanup.",
        })
      );
      const preparation = yield* Effect.promise(() =>
        t.query((ctx) =>
          ctx.db.get("accountDeletionPreparations", preparationId)
        )
      );
      expect(preparation).toMatchObject({
        recoveryAt: NOW - 1,
        recoveryGeneration: 0,
      });
    })
  );
  it.live("requests another page after one full recovery batch", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      vi.setSystemTime(NOW);
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          for (
            let index = 0;
            index < ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE;
            index += 1
          ) {
            const userId = await ctx.db.insert("users", {
              authId: `batch-recovery-owner-${index}`,
              credits: 0,
              creditsResetAt: 0,
              email: `batch-recovery-owner-${index}@example.com`,
              name: `Batch Recovery Owner ${index}`,
              plan: "free",
            });
            await ctx.db.insert("accountDeletionPreparations", {
              attemptId: ATTEMPT_ID,
              authId: `batch-recovery-owner-${index}`,
              recoveryAt: NOW - 1,
              recoveryGeneration: 0,
              userId,
            });
          }
        })
      );
      const hasMore = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            sweepAccountDeletionRecoveryProgram().pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      expect(hasMore).toBe(true);
      expect(
        yield* Effect.promise(() =>
          t.query(async (ctx) =>
            Arr.filter(
              await ctx.db.system.query("_scheduled_functions").collect(),
              (job) =>
                job.name ===
                Ref.getConvexFunctionName(
                  refs.internal.auth.deletion.recovery.recoverAccountDeletion
                )
            )
          )
        )
      ).toHaveLength(ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE);
    })
  );
});
