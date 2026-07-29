import {
  cancelAccountDeletionAttempt,
  cancelAccountDeletionAttemptByToken,
} from "@repo/backend/convex/auth/deletion/attemptCancellation";
import { claimAccountDeletion } from "@repo/backend/convex/auth/deletion/claim";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import {
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/convex/auth/deletion/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 9, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("auth/deletion/attemptCancellation", () => {
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

    expect(canceled).toBeNull();
    expect(authUserExists).not.toHaveBeenCalled();
    expect(state.preparation?.deletionStartedAt).toBe(NOW);
    expect(state.user?.deletionPreparedAt).toBe(NOW);
  });

  it("treats an already-absent preparation as completely canceled", async () => {
    const t = convexTest(schema, convexModules);
    const authUserExists = vi.fn(async () => true);

    const outcome = await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletionAttemptByToken(ctx, ATTEMPT_ID, authUserExists)
      )
    );

    expect(outcome).toBe(accountDeletionCancellationOutcome.complete);
    expect(authUserExists).not.toHaveBeenCalled();
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

  it("reports every browser-owned cancellation batch until complete", async () => {
    const t = convexTest(schema, convexModules);
    const ownerId = await t.mutation(async (ctx) => {
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

      return ownerId;
    });
    const authUserExists = vi.fn(async () => true);
    const firstOutcome = await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletionAttemptByToken(ctx, ATTEMPT_ID, authUserExists)
      )
    );
    const replayedAttempt = await t.mutation((ctx) =>
      runConvexProgram(
        claimAccountDeletion(ctx, "batch-cancel-owner", ATTEMPT_ID)
      )
    );
    const pending = await t.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
      user: await ctx.db.get("users", ownerId),
    }));

    expect(firstOutcome).toBe(accountDeletionCancellationOutcome.continue);
    expect(replayedAttempt).toBe(
      accountDeletionPreparationOutcome.temporarilyUnavailable
    );
    expect(pending.preparation?.cancellationStartedAt).toEqual(
      expect.any(Number)
    );
    expect(pending.transfers).toHaveLength(1);
    expect(pending.jobs).toHaveLength(0);
    expect(pending.user?.deletionPreparedAt).toBe(NOW);

    const finalOutcome = await t.mutation((ctx) =>
      runConvexProgram(
        cancelAccountDeletionAttemptByToken(ctx, ATTEMPT_ID, authUserExists)
      )
    );

    const remaining = await t.query(async (ctx) => ({
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
      user: await ctx.db.get("users", ownerId),
    }));

    expect(finalOutcome).toBe(accountDeletionCancellationOutcome.complete);
    expect(authUserExists).toHaveBeenCalledTimes(2);
    expect(remaining.preparations).toEqual([]);
    expect(remaining.transfers).toEqual([]);
    expect(remaining.user).not.toHaveProperty("deletionPreparedAt");
  });
});
