import {
  ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  recoverAccountDeletionProgram,
  sweepAccountDeletionRecoveryProgram,
} from "@repo/backend/convex/auth/deletion/recovery";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 11, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("auth/deletion/recovery", () => {
  it("cancels preparation while the auth user still exists", async () => {
    const cancel = vi.fn(async () => false);
    const finalize = vi.fn(async () => undefined);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(async () => true),
        cancel,
        continueCommit: vi.fn(async () => false),
        finalize,
      })
    );

    expect(cancel).toHaveBeenCalledOnce();
    expect(finalize).not.toHaveBeenCalled();
  });

  it("finalizes preparation after the auth user is gone", async () => {
    const cancel = vi.fn(async () => false);
    const finalize = vi.fn(async () => undefined);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(async () => false),
        cancel,
        continueCommit: vi.fn(async () => false),
        finalize,
      })
    );

    expect(cancel).not.toHaveBeenCalled();
    expect(finalize).toHaveBeenCalledOnce();
  });

  it("keeps failed recovery typed for the durable sweep to retry", async () => {
    const failure = await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(() =>
          Promise.reject(new Error("auth unavailable"))
        ),
        cancel: vi.fn(async () => false),
        continueCommit: vi.fn(async () => false),
        finalize: vi.fn(async () => undefined),
      }).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "UserCleanupError",
      code: "USER_CLEANUP_FAILED",
      message: "auth unavailable",
    });
  });

  it("delegates exactly one bounded cancellation batch", async () => {
    const cancel = vi.fn(async () => true);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(async () => true),
        cancel,
        continueCommit: vi.fn(async () => false),
        finalize: vi.fn(async () => undefined),
      })
    );

    expect(cancel).toHaveBeenCalledOnce();
  });

  it("continues a claimed deletion without reopening cancellation", async () => {
    const authUserExists = vi.fn(async () => true);
    const cancel = vi.fn(async () => false);
    const continueCommit = vi.fn(async () => true);
    const finalize = vi.fn(async () => undefined);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists,
        cancel,
        continueCommit,
        finalize,
      })
    );

    expect(continueCommit).toHaveBeenCalledOnce();
    expect(authUserExists).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it("claims only due preparations before scheduling recovery", async () => {
    vi.setSystemTime(NOW);
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
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

      return { dueId, futureId };
    });
    const scheduleRecovery = vi.fn(async () => undefined);

    const hasMore = await t.mutation((ctx) =>
      runConvexProgram(
        sweepAccountDeletionRecoveryProgram(ctx, scheduleRecovery)
      )
    );
    const state = await t.query(async (ctx) => ({
      due: await ctx.db.get("accountDeletionPreparations", seeded.dueId),
      future: await ctx.db.get("accountDeletionPreparations", seeded.futureId),
    }));

    expect(hasMore).toBe(false);
    expect(state.due).toMatchObject({
      recoveryAt: NOW + ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
      recoveryGeneration: 3,
    });
    expect(state.future).toMatchObject({
      recoveryAt: NOW + 1,
      recoveryGeneration: 0,
    });
    expect(scheduleRecovery).toHaveBeenCalledExactlyOnceWith(
      expect.any(Object),
      "due-recovery-owner",
      {
        attemptId: ATTEMPT_ID,
        preparationId: seeded.dueId,
        recoveryGeneration: 3,
      }
    );
  });

  it("clears an invalid recovery lease without scheduling it", async () => {
    vi.setSystemTime(NOW);
    const t = convexTest(schema, convexModules);
    const preparationId = await t.mutation(async (ctx) => {
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
    });
    const scheduleRecovery = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        sweepAccountDeletionRecoveryProgram(ctx, scheduleRecovery)
      )
    );
    const preparation = await t.query((ctx) =>
      ctx.db.get("accountDeletionPreparations", preparationId)
    );

    expect(preparation).not.toHaveProperty("recoveryAt");
    expect(scheduleRecovery).not.toHaveBeenCalled();
  });

  it("rolls back the lease when scheduling fails", async () => {
    vi.setSystemTime(NOW);
    const t = convexTest(schema, convexModules);
    const preparationId = await t.mutation(async (ctx) => {
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
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          sweepAccountDeletionRecoveryProgram(ctx, () =>
            Promise.reject(new Error("scheduler unavailable"))
          )
        )
      )
    ).rejects.toThrow("scheduler unavailable");

    const preparation = await t.query((ctx) =>
      ctx.db.get("accountDeletionPreparations", preparationId)
    );

    expect(preparation).toMatchObject({
      recoveryAt: NOW - 1,
      recoveryGeneration: 0,
    });
  });

  it("requests another page after one full recovery batch", async () => {
    vi.setSystemTime(NOW);
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
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
    });
    const scheduleRecovery = vi.fn(async () => undefined);

    const hasMore = await t.mutation((ctx) =>
      runConvexProgram(
        sweepAccountDeletionRecoveryProgram(ctx, scheduleRecovery)
      )
    );

    expect(hasMore).toBe(true);
    expect(scheduleRecovery).toHaveBeenCalledTimes(
      ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE
    );
  });
});
