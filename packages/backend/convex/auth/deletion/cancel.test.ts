import { internal } from "@repo/backend/convex/_generated/api";
import {
  cancelAccountDeletion,
  cancelAccountDeletionAttempt,
  cancelAccountDeletionAttemptBatch,
  cancelAccountDeletionAttemptByToken,
  cleanupFinalizedAccountDeletion,
} from "@repo/backend/convex/auth/deletion/cancel";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 9, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("auth/deletion/cancel", () => {
  it("restores access and removes every active reservation", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "cancel-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW,
        email: "owner@example.com",
        name: "Cancel Owner",
        plan: "free",
      });
      const successorId = await ctx.db.insert("users", {
        authId: "cancel-successor",
        credits: 0,
        creditsResetAt: 0,
        email: "successor@example.com",
        name: "Cancel Successor",
        plan: "free",
      });
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: ownerId,
        currentStudents: 1,
        currentTeachers: 0,
        email: "school@example.com",
        name: "Cancel School",
        province: "DKI Jakarta",
        slug: "cancel-school",
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
        authId: "cancel-owner",
        recoveryGeneration: 0,
        userId: ownerId,
      });
      await ctx.db.insert("accountDeletionSchoolTransfers", {
        preparationId,
        schoolId,
        successorMembershipId: membershipId,
        successorUserId: successorId,
      });

      return { ownerId, preparationId, schoolId };
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletion(ctx, "cancel-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        })
      )
    );

    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
      school: await ctx.db.get("schools", seeded.schoolId),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(state.owner).not.toHaveProperty("deletionPreparedAt");
    expect(state.owner).not.toHaveProperty("deletedAt");
    expect(state.school?.createdBy).toBe(seeded.ownerId);
    expect(state.preparations).toHaveLength(0);
    expect(state.transfers).toHaveLength(0);
  });

  it("leaves a newer preparation untouched", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "newer-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW + 1,
        email: "newer@example.com",
        name: "Newer Owner",
        plan: "free",
      });
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "newer-owner",
        recoveryGeneration: 1,
        userId: insertedUserId,
      });
      return { preparationId, userId: insertedUserId };
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletion(ctx, "newer-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        })
      )
    );

    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", seeded.userId),
    }));

    expect(state.preparation?.recoveryGeneration).toBe(1);
    expect(state.user?.deletionPreparedAt).toBe(NOW + 1);
  });

  it("never cancels a finalized account", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "finalized-owner",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        email: "finalized@example.com",
        name: "Finalized Owner",
        plan: "free",
      });
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "finalized-owner",
        finalizedAt: NOW,
        recoveryGeneration: 0,
        userId: insertedUserId,
      });
      return { preparationId, userId: insertedUserId };
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletion(ctx, "finalized-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        })
      )
    );

    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", seeded.userId),
    }));

    expect(state.preparation?.finalizedAt).toBe(NOW);
    expect(state.user?.deletedAt).toBe(NOW);
  });

  it("never reopens an irreversible deletion from the browser token", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "started-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW,
        email: "started@example.com",
        name: "Started Owner",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "started-owner",
        deletionStartedAt: NOW,
        recoveryGeneration: 1,
        userId: insertedUserId,
      });
      return insertedUserId;
    });
    const authUserExists = vi.fn(async () => true);

    const canceled = await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletionAttemptByToken(ctx, ATTEMPT_ID, authUserExists)
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", userId),
    }));

    expect(canceled).toBe(false);
    expect(authUserExists).not.toHaveBeenCalled();
    expect(state.preparation?.deletionStartedAt).toBe(NOW);
    expect(state.user?.deletionPreparedAt).toBe(NOW);
  });

  it("removes finalized metadata after workflow admission", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "cleanup-owner",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        deletionCleanupStartedAt: NOW,
        email: "cleanup@example.com",
        name: "Cleanup Owner",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "cleanup-owner",
        finalizedAt: NOW,
        recoveryGeneration: 0,
        userId: insertedUserId,
      });
      return insertedUserId;
    });

    const removed = await t.mutation((ctx) =>
      runConvexProgram(cleanupFinalizedAccountDeletion(ctx, userId))
    );
    const preparationCount = await t.query(
      async (ctx) =>
        (await ctx.db.query("accountDeletionPreparations").collect()).length
    );

    expect(removed).toBe(true);
    expect(preparationCount).toBe(0);
  });

  it("does not cancel another browser attempt", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "attempt-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW,
        email: "attempt@example.com",
        name: "Attempt Owner",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "attempt-owner",
        recoveryGeneration: 0,
        userId: insertedUserId,
      });
      return insertedUserId;
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletionAttempt(
          ctx,
          "attempt-owner",
          "019fa44c-02be-7cd0-a4ed-61a7af8e0621"
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", userId),
    }));

    expect(state.preparation?.attemptId).toBe(ATTEMPT_ID);
    expect(state.user?.deletionPreparedAt).toBe(NOW);
  });

  it("drains reservations larger than one transaction batch", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "batch-cancel-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW,
        email: "batch-cancel-owner@example.com",
        name: "Batch Cancel Owner",
        plan: "free",
      });
      const successorId = await ctx.db.insert("users", {
        authId: "batch-cancel-successor",
        credits: 0,
        creditsResetAt: 0,
        email: "batch-cancel-successor@example.com",
        name: "Batch Cancel Successor",
        plan: "free",
      });
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: ownerId,
        currentStudents: 1,
        currentTeachers: 0,
        email: "batch-cancel-school@example.com",
        name: "Batch Cancel School",
        province: "DKI Jakarta",
        slug: "batch-cancel-school",
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
      const id = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "batch-cancel-owner",
        recoveryGeneration: 0,
        userId: ownerId,
      });

      for (
        let index = 0;
        index <= ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
        index += 1
      ) {
        await ctx.db.insert("accountDeletionSchoolTransfers", {
          preparationId: id,
          schoolId,
          successorMembershipId: membershipId,
          successorUserId: successorId,
        });
      }

      return id;
    });
    await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletionAttemptBatch(ctx, "batch-cancel-owner", ATTEMPT_ID)
      )
    );
    const pending = await t.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(pending.transfers).toHaveLength(1);
    expect(pending.jobs).toEqual([
      expect.objectContaining({
        name: expect.stringContaining("continueAccountDeletionCancellation"),
      }),
    ]);

    await t.mutation(
      internal.auth.deletion.continueAccountDeletionCancellation,
      {
        attemptId: ATTEMPT_ID,
        authId: "batch-cancel-owner",
      }
    );

    const remaining = await t.query(async (ctx) => ({
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(remaining).toEqual({ preparations: [], transfers: [] });
  });
});
