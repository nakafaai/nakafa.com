import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import {
  getAccountDeletionAttemptStatusProgram,
  recordAccountDeletionReceipt,
  sweepAccountDeletionReceiptsProgram,
} from "@repo/backend/confect/auth/deletion/receipt";
import { accountDeletionAttemptStatus } from "@repo/backend/confect/auth/deletion/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const COMMITTED_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const PENDING_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0621";
const DELETED_AUTH_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0622";
const UNKNOWN_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0623";
const FINALIZED_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0624";
function insertUser(ctx: MutationCtx, authId: string) {
  return Effect.promise(() =>
    ctx.db.insert("users", {
      authId,
      credits: 0,
      creditsResetAt: 0,
      email: `${authId}@example.com`,
      name: authId,
      plan: "free",
    })
  );
}
describe("auth/deletion/receipt", () => {
  it.live(
    "distinguishes committed, pending, and unknown browser attempts",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              Effect.gen(function* () {
                const pendingUserId = yield* insertUser(ctx, "pending-auth");
                const deletedAuthUserId = yield* insertUser(
                  ctx,
                  "deleted-auth"
                );
                yield* Effect.promise(() =>
                  ctx.db.insert("accountDeletionReceipts", {
                    attemptId: COMMITTED_ATTEMPT_ID,
                    committedAt: 1,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.insert("accountDeletionPreparations", {
                    attemptId: PENDING_ATTEMPT_ID,
                    authId: "pending-auth",
                    recoveryGeneration: 0,
                    userId: pendingUserId,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.insert("accountDeletionPreparations", {
                    attemptId: DELETED_AUTH_ATTEMPT_ID,
                    authId: "deleted-auth",
                    recoveryGeneration: 0,
                    userId: deletedAuthUserId,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.insert("accountDeletionPreparations", {
                    attemptId: FINALIZED_ATTEMPT_ID,
                    authId: "pending-auth",
                    finalizedAt: 1,
                    recoveryGeneration: 0,
                    userId: pendingUserId,
                  })
                );
              }).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const authUserExists = vi.fn((authId: string) =>
          Effect.succeed(authId === "pending-auth")
        );
        const getStatus = (attemptId: string) =>
          Effect.promise(() =>
            t.query((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                getAccountDeletionAttemptStatusProgram(
                  attemptId,
                  authUserExists
                ).pipe(
                  Effect.provide(
                    ConfectDatabaseReader.layer(confectSchema, ctx.db)
                  )
                )
              )
            )
          );
        expect(yield* getStatus(COMMITTED_ATTEMPT_ID)).toBe(
          accountDeletionAttemptStatus.committed
        );
        expect(yield* getStatus(PENDING_ATTEMPT_ID)).toBe(
          accountDeletionAttemptStatus.pending
        );
        expect(yield* getStatus(DELETED_AUTH_ATTEMPT_ID)).toBe(
          accountDeletionAttemptStatus.committed
        );
        expect(yield* getStatus(FINALIZED_ATTEMPT_ID)).toBe(
          accountDeletionAttemptStatus.committed
        );
        expect(yield* getStatus(UNKNOWN_ATTEMPT_ID)).toBe(
          accountDeletionAttemptStatus.unknown
        );
        expect(authUserExists).toHaveBeenCalledTimes(2);
      })
  );
  it.live("records one idempotent privacy-minimal receipt", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            Effect.gen(function* () {
              yield* recordAccountDeletionReceipt(COMMITTED_ATTEMPT_ID, 1);
              yield* recordAccountDeletionReceipt(COMMITTED_ATTEMPT_ID, 2);
              yield* recordAccountDeletionReceipt(undefined, 3);
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const receipts = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query("accountDeletionReceipts").collect())
      );
      expect(receipts).toEqual([
        expect.objectContaining({
          attemptId: COMMITTED_ATTEMPT_ID,
          committedAt: 1,
        }),
      ]);
    })
  );
  it.live("deletes expired receipts in bounded pages", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            Effect.gen(function* () {
              for (
                let index = 0;
                index <= ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE;
                index += 1
              ) {
                yield* Effect.promise(() =>
                  ctx.db.insert("accountDeletionReceipts", {
                    attemptId: `expired-${index}`,
                    committedAt: 0,
                  })
                );
              }
              yield* Effect.promise(() =>
                ctx.db.insert("accountDeletionReceipts", {
                  attemptId: "future",
                  committedAt: Number.MAX_SAFE_INTEGER,
                })
              );
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const firstSweep = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            sweepAccountDeletionReceiptsProgram().pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const secondSweep = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            sweepAccountDeletionReceiptsProgram().pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const receipts = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query("accountDeletionReceipts").collect())
      );
      expect(firstSweep).toBe(true);
      expect(secondSweep).toBe(false);
      expect(receipts).toEqual([
        expect.objectContaining({
          attemptId: "future",
        }),
      ]);
    })
  );
});
