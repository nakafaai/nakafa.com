import { api, internal } from "@repo/backend/convex/_generated/api";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { accountDeletionAttemptStatus } from "@repo/backend/convex/auth/deletion/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 12, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const COMMITTED_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0621";
const UNKNOWN_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0622";

describe("auth/deletion", () => {
  it("advances one authenticated preparation step", async () => {
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

  it("lets a prepared auth session cancel its own deletion", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "cancel-current-deletion",
      })
    );
    await t.mutation(async (ctx) => {
      await ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: identity.authUserId,
        recoveryGeneration: 0,
        userId: identity.userId,
      });
    });

    await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(api.auth.deletion.cancelCurrentAccountDeletion, {
        attemptId: ATTEMPT_ID,
      });

    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", identity.userId),
    }));

    expect(state.preparation).toBeNull();
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
  });

  it("schedules the next versioned recovery cancellation batch", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "cancel-recovery-batch",
      });
      const successorId = await ctx.db.insert("users", {
        authId: "cancel-recovery-successor",
        credits: 0,
        creditsResetAt: NOW,
        email: "cancel-recovery-successor@example.com",
        name: "Cancel Recovery Successor",
        plan: "free",
      });
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: identity.userId,
        currentStudents: 1,
        currentTeachers: 0,
        email: "cancel-recovery-school@example.com",
        name: "Cancel Recovery School",
        province: "DKI Jakarta",
        slug: "cancel-recovery-school",
        type: "high-school",
        updatedAt: NOW,
      });
      const membershipId = await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "student",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: successorId,
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

      for (
        let index = 0;
        index <= ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
        index += 1
      ) {
        await ctx.db.insert("accountDeletionSchoolTransfers", {
          preparationId,
          schoolId,
          successorMembershipId: membershipId,
          successorUserId: successorId,
        });
      }

      return { identity, preparationId };
    });
    const expectedPreparation = {
      attemptId: ATTEMPT_ID,
      preparationId: seeded.preparationId,
      recoveryGeneration: 1,
    };

    const hasMore = await t.mutation(
      internal.auth.deletion.cancelAccountDeletion,
      {
        authId: seeded.identity.authUserId,
        expectedPreparation,
      }
    );
    const state = await t.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
      user: await ctx.db.get("users", seeded.identity.userId),
    }));

    expect(hasMore).toBe(true);
    expect(state.transfers).toHaveLength(1);
    expect(state.preparation).not.toBeNull();
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
    expect(state.jobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            authId: seeded.identity.authUserId,
            expectedPreparation,
          }),
        ],
        name: expect.stringContaining("auth/deletion:cancelAccountDeletion"),
      }),
    ]);
  });
});
