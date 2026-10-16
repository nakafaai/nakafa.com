import { describe, expect, it } from "@effect/vitest";
import {
  ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE,
  ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE,
} from "@repo/backend/confect/auth/deletion/constants";
import {
  accountDeletionAttemptStatus,
  accountDeletionCancellationOutcome,
} from "@repo/backend/confect/auth/deletion/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

const NOW = Date.UTC(2026, 6, 28, 12, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const COMMITTED_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0621";
const UNKNOWN_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0622";

describe("auth/deletion", () => {
  it("prepares the authenticated account in one step", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepare-current-deletion",
      })
    );

    const outcome = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(api.auth.deletion.prepareCurrentAccountDeletion, {
        attemptId: ATTEMPT_ID,
      });
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", identity.userId),
    }));

    expect(outcome).toBe("ready");
    expect(state.preparation).toMatchObject({
      attemptId: ATTEMPT_ID,
      authId: identity.authUserId,
      userId: identity.userId,
    });
    expect(state.user?.deletionPreparedAt).toEqual(expect.any(Number));
  });

  it("exposes only the commit status for an opaque browser attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "deletion-attempt-status",
      })
    );
    await t.mutation(async (ctx) => {
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: identity.authUserId,
        recoveryGeneration: 0,
        userId: identity.userId,
      });
      await ctx.db.insert("accountDeletionReceipts", {
        attemptId: COMMITTED_ATTEMPT_ID,
        committedAt: NOW,
      });
    });

    await expect(
      t.query(api.auth.deletion.getAccountDeletionAttemptStatus, {
        attemptId: ATTEMPT_ID,
      })
    ).resolves.toBe(accountDeletionAttemptStatus.pending);
    await expect(
      t.query(api.auth.deletion.getAccountDeletionAttemptStatus, {
        attemptId: COMMITTED_ATTEMPT_ID,
      })
    ).resolves.toBe(accountDeletionAttemptStatus.committed);
    await expect(
      t.query(api.auth.deletion.getAccountDeletionAttemptStatus, {
        attemptId: UNKNOWN_ATTEMPT_ID,
      })
    ).resolves.toBe(accountDeletionAttemptStatus.unknown);
  });

  it("cancels a live browser attempt and ignores its obsolete commit", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "cancel-current-deletion",
      })
    );
    const preparationId = await t.mutation(async (ctx) => {
      await ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      });
      return await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: identity.authUserId,
        recoveryGeneration: 0,
        userId: identity.userId,
      });
    });

    await expect(
      t.mutation(api.auth.deletion.cancelAccountDeletionAttempt, {
        attemptId: ATTEMPT_ID,
      })
    ).resolves.toBe(accountDeletionCancellationOutcome.complete);
    await expect(
      t.mutation(internal.auth.deletion.continueAccountDeletionCommit, {
        authId: identity.authUserId,
        expectedPreparation: {
          attemptId: ATTEMPT_ID,
          preparationId,
          recoveryGeneration: 0,
        },
      })
    ).resolves.toBe(false);

    const state = await t.query(async (ctx) => ({
      cancellation: await ctx.db
        .query("accountDeletionAttemptCancellations")
        .unique(),
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", identity.userId),
    }));

    expect(state.cancellation).toMatchObject({ attemptId: ATTEMPT_ID });
    expect(state.preparation).toBeNull();
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
  });

  it("rejects cancellation when the auth user is already gone", async () => {
    const t = createConvexTestWithBetterAuth();
    const preparationId = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "removed-auth-user",
        credits: 0,
        creditsResetAt: NOW,
        deletionPreparedAt: NOW,
        email: "removed-auth-user@example.com",
        mascot: MASCOT_CODE,
        name: "Removed Auth User",
        plan: "free",
      });

      return await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "removed-auth-user",
        recoveryGeneration: 0,
        userId,
      });
    });

    await expect(
      t.mutation(api.auth.deletion.cancelAccountDeletionAttempt, {
        attemptId: ATTEMPT_ID,
      })
    ).rejects.toMatchObject({
      data: {
        code: ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE,
      },
    });

    await expect(
      t.query((ctx) => ctx.db.get("accountDeletionPreparations", preparationId))
    ).resolves.not.toBeNull();
  });

  it("cancels the exact prepared version for recovery", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "cancel-recovery",
      });
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: identity.authUserId,
        recoveryGeneration: 1,
        userId: identity.userId,
      });

      await ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      });

      return { identity, preparationId };
    });
    const expectedPreparation = {
      attemptId: ATTEMPT_ID,
      preparationId: seeded.preparationId,
      recoveryGeneration: 1,
    };

    await expect(
      t.mutation(internal.auth.deletion.cancelAccountDeletion, {
        authId: seeded.identity.authUserId,
        expectedPreparation,
      })
    ).resolves.toBeNull();
    const state = await t.query(async (ctx) => ({
      cancellations: await ctx.db
        .query("accountDeletionAttemptCancellations")
        .collect(),
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      user: await ctx.db.get("users", seeded.identity.userId),
    }));

    expect(state.preparation).toBeNull();
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
    expect(state.cancellations).toEqual([
      expect.objectContaining({ attemptId: ATTEMPT_ID }),
    ]);
  });

  it.each(["cancellations", "receipts"])(
    "continues expired %s cleanup until both retention tables are drained",
    async (kind) => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const t = createConvexTestWithBetterAuth();
      await t.mutation(async (ctx) => {
        for (
          let index = 0;
          index <= ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE;
          index += 1
        ) {
          const attemptId = `expired-${index}`;
          if (kind === "cancellations") {
            await ctx.db.insert("accountDeletionAttemptCancellations", {
              attemptId,
              canceledAt: 0,
            });
          } else {
            await ctx.db.insert("accountDeletionReceipts", {
              attemptId,
              committedAt: 0,
            });
          }
        }
        await ctx.db.insert("accountDeletionAttemptCancellations", {
          attemptId: "retained-cancellation",
          canceledAt: NOW,
        });
        await ctx.db.insert("accountDeletionReceipts", {
          attemptId: "retained-receipt",
          committedAt: NOW,
        });
      });

      await expect(
        t.mutation(internal.auth.deletion.sweepAccountDeletionRetention, {})
      ).resolves.toBeNull();
      const pending = await t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").take(2)
      );
      expect(pending).toMatchObject([
        {
          args: [{}],
          name: "auth/deletion:sweepAccountDeletionRetention",
          state: { kind: "pending" },
        },
      ]);

      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const remaining = await t.query(async (ctx) => ({
        cancellations: await ctx.db
          .query("accountDeletionAttemptCancellations")
          .take(2),
        receipts: await ctx.db.query("accountDeletionReceipts").take(2),
      }));
      expect(remaining).toMatchObject({
        cancellations: [{ attemptId: "retained-cancellation" }],
        receipts: [{ attemptId: "retained-receipt" }],
      });
    }
  );
});
