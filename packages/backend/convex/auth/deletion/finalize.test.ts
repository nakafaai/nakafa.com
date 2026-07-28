import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE,
  ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import { finalizeAccountDeletion } from "@repo/backend/convex/auth/deletion/finalize";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 10, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

/** Inserts one app user with optional deletion state. */
function insertUser(
  ctx: MutationCtx,
  authId: string,
  deletionPreparedAt?: number
) {
  return ctx.db.insert("users", {
    authId,
    credits: 0,
    creditsResetAt: 0,
    deletionPreparedAt,
    email: `${authId}@example.com`,
    name: authId,
    plan: "free",
  });
}

async function seedPreparedSchool(ctx: MutationCtx, authId: string) {
  const ownerId = await insertUser(ctx, authId, NOW);
  const successorId = await insertUser(ctx, `${authId}-successor`);
  const schoolId = await ctx.db.insert("schools", {
    city: "Jakarta",
    createdBy: ownerId,
    currentStudents: 1,
    currentTeachers: 0,
    email: `${authId}-school@example.com`,
    name: "Prepared School",
    province: "DKI Jakarta",
    slug: `${authId}-school`,
    type: "high-school",
    updatedAt: NOW,
  });
  await ctx.db.insert("schoolMembers", {
    joinedAt: NOW,
    role: "admin",
    schoolId,
    status: "active",
    updatedAt: NOW,
    userId: ownerId,
  });
  const successorMembershipId = await ctx.db.insert("schoolMembers", {
    joinedAt: NOW,
    role: "student",
    schoolId,
    status: "active",
    updatedAt: NOW,
    userId: successorId,
  });
  const preparationId = await ctx.db.insert("accountDeletionPreparations", {
    attemptId: ATTEMPT_ID,
    authId,
    recoveryAt: NOW,
    recoveryGeneration: 0,
    userId: ownerId,
  });
  await ctx.db.insert("accountDeletionSchoolTransfers", {
    preparationId,
    schoolId,
    successorMembershipId,
    successorUserId: successorId,
  });

  return {
    ownerId,
    preparationId,
    schoolId,
    successorId,
    successorMembershipId,
  };
}

describe("auth/deletion/finalize", () => {
  it("atomically transfers schools, tombstones the user, and queues cleanup", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const seeded = await t.mutation((ctx) =>
      seedPreparedSchool(ctx, "finalize-owner")
    );

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "finalize-owner",
          {
            attemptId: ATTEMPT_ID,
            preparationId: seeded.preparationId,
            recoveryGeneration: 0,
          },
          scheduleCleanup
        )
      )
    );

    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      school: await ctx.db.get("schools", seeded.schoolId),
      successorMembership: await ctx.db.get(
        "schoolMembers",
        seeded.successorMembershipId
      ),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(state.owner?.deletedAt).toEqual(expect.any(Number));
    expect(state.owner).toMatchObject({
      authId: `deleted:${seeded.ownerId}`,
      credits: 0,
      creditsResetAt: 0,
      email: `deleted-${seeded.ownerId}@account.nakafa.invalid`,
      name: "Deleted user",
      plan: "free",
    });
    expect(state.owner).not.toHaveProperty("deletionPreparedAt");
    expect(state.owner).not.toHaveProperty("image");
    expect(state.owner).not.toHaveProperty("role");
    expect(state.preparation?.finalizedAt).toEqual(expect.any(Number));
    expect(state.preparation).not.toHaveProperty("recoveryAt");
    expect(state.school).toMatchObject({
      createdBy: seeded.successorId,
      updatedBy: seeded.successorId,
    });
    expect(state.successorMembership?.role).toBe("admin");
    expect(state.transfers).toHaveLength(0);
    expect(scheduleCleanup).toHaveBeenCalledWith(expect.any(Object), {
      authId: "finalize-owner",
      userId: seeded.ownerId,
    });
  });

  it("ignores recovery for a newer preparation", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedSchool(ctx, "newer-finalize-owner");
      await ctx.db.patch("accountDeletionPreparations", result.preparationId, {
        recoveryGeneration: 1,
      });
      await ctx.db.patch("users", result.ownerId, {
        deletionPreparedAt: NOW + 1,
      });
      return result;
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "newer-finalize-owner",
          {
            attemptId: ATTEMPT_ID,
            preparationId: seeded.preparationId,
            recoveryGeneration: 0,
          },
          scheduleCleanup
        )
      )
    );

    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      school: await ctx.db.get("schools", seeded.schoolId),
    }));

    expect(state.owner?.deletionPreparedAt).toBe(NOW + 1);
    expect(state.owner).not.toHaveProperty("deletedAt");
    expect(state.school?.createdBy).toBe(seeded.ownerId);
    expect(scheduleCleanup).not.toHaveBeenCalled();
  });

  it("requeues cleanup from the finalized journal after profile anonymization", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const seeded = await t.mutation((ctx) =>
      seedPreparedSchool(ctx, "requeue-finalize-owner")
    );

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "requeue-finalize-owner",
          {
            attemptId: ATTEMPT_ID,
            preparationId: seeded.preparationId,
            recoveryGeneration: 0,
          },
          scheduleCleanup
        )
      )
    );
    scheduleCleanup.mockClear();

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "requeue-finalize-owner",
          undefined,
          scheduleCleanup
        )
      )
    );

    expect(scheduleCleanup).toHaveBeenCalledWith(expect.any(Object), {
      authId: "requeue-finalize-owner",
      userId: seeded.ownerId,
    });
  });

  it("retains a shared school on the tombstone after reservation corruption", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const scheduleContinuation = vi.fn(async () => undefined);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedSchool(ctx, "blocked-finalize-owner");
      await ctx.db.patch("users", result.successorId, {
        deletionPreparedAt: NOW,
      });
      return result;
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "blocked-finalize-owner",
          {
            attemptId: ATTEMPT_ID,
            preparationId: seeded.preparationId,
            recoveryGeneration: 0,
          },
          scheduleCleanup,
          scheduleContinuation
        )
      )
    );
    expect(scheduleContinuation).toHaveBeenCalledOnce();
    expect(scheduleCleanup).not.toHaveBeenCalled();

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "blocked-finalize-owner",
          {
            attemptId: ATTEMPT_ID,
            preparationId: seeded.preparationId,
            recoveryGeneration: 0,
          },
          scheduleCleanup,
          scheduleContinuation
        )
      )
    );

    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      school: await ctx.db.get("schools", seeded.schoolId),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(state.owner?.deletedAt).toEqual(expect.any(Number));
    expect(state.owner).not.toHaveProperty("deletionPreparedAt");
    expect(state.preparation?.finalizedAt).toEqual(expect.any(Number));
    expect(state.school?.createdBy).toBe(seeded.ownerId);
    expect(state.transfers).toEqual([]);
    expect(scheduleCleanup).toHaveBeenCalledWith(expect.any(Object), {
      authId: "blocked-finalize-owner",
      userId: seeded.ownerId,
    });
  });

  it("continues fallback past a full page of unavailable successors", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const scheduleContinuation = vi.fn(async () => undefined);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedSchool(ctx, "fallback-finalize-owner");
      await ctx.db.patch("users", result.successorId, {
        deletionPreparedAt: NOW,
      });

      for (
        let index = 1;
        index < ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE;
        index += 1
      ) {
        const userId = await insertUser(ctx, `fallback-deleting-${index}`, NOW);
        await ctx.db.insert("schoolMembers", {
          joinedAt: NOW,
          role: "student",
          schoolId: result.schoolId,
          status: "active",
          updatedAt: NOW,
          userId,
        });
      }

      const activeSuccessorId = await insertUser(ctx, "fallback-active");
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "student",
        schoolId: result.schoolId,
        status: "active",
        updatedAt: NOW,
        userId: activeSuccessorId,
      });

      return { ...result, activeSuccessorId };
    });
    const expectedPreparation = {
      attemptId: ATTEMPT_ID,
      preparationId: seeded.preparationId,
      recoveryGeneration: 0,
    };
    const finalize = () =>
      t.mutation((ctx) =>
        runConvexProgram(
          finalizeAccountDeletion(
            ctx,
            "fallback-finalize-owner",
            expectedPreparation,
            scheduleCleanup,
            scheduleContinuation
          )
        )
      );

    await finalize();
    expect(scheduleContinuation).toHaveBeenCalledOnce();
    expect(scheduleCleanup).not.toHaveBeenCalled();

    await finalize();
    expect(scheduleContinuation).toHaveBeenCalledTimes(2);
    expect(scheduleCleanup).not.toHaveBeenCalled();

    await finalize();
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      school: await ctx.db.get("schools", seeded.schoolId),
    }));

    expect(state.owner?.deletedAt).toEqual(expect.any(Number));
    expect(state.school?.createdBy).toBe(seeded.activeSuccessorId);
    expect(scheduleCleanup).toHaveBeenCalledOnce();
  });

  it("journals direct auth removals without a preparation", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const userId = await t.mutation((ctx) =>
      insertUser(ctx, "direct-auth-removal")
    );

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "direct-auth-removal",
          undefined,
          scheduleCleanup
        )
      )
    );

    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", userId),
    }));

    expect(state.user?.deletedAt).toEqual(expect.any(Number));
    expect(state.user).toMatchObject({
      authId: `deleted:${userId}`,
      email: `deleted-${userId}@account.nakafa.invalid`,
      name: "Deleted user",
    });
    expect(state.preparation).toMatchObject({
      authId: "direct-auth-removal",
      finalizedAt: expect.any(Number),
      userId,
    });
    expect(scheduleCleanup).toHaveBeenCalledWith(expect.any(Object), {
      authId: "direct-auth-removal",
      userId,
    });
  });

  it("continues finalization beyond one transaction batch", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const scheduleContinuation = vi.fn(async () => undefined);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedSchool(ctx, "batch-finalize-owner");

      for (
        let index = 1;
        index <= ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
        index += 1
      ) {
        await ctx.db.insert("accountDeletionSchoolTransfers", {
          preparationId: result.preparationId,
          schoolId: result.schoolId,
          successorMembershipId: result.successorMembershipId,
          successorUserId: result.successorId,
        });
      }

      return result;
    });
    const expectedPreparation = {
      attemptId: ATTEMPT_ID,
      preparationId: seeded.preparationId,
      recoveryGeneration: 0,
    };

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "batch-finalize-owner",
          expectedPreparation,
          scheduleCleanup,
          scheduleContinuation
        )
      )
    );
    const pendingOwner = await t.query((ctx) =>
      ctx.db.get("users", seeded.ownerId)
    );

    expect(pendingOwner).not.toHaveProperty("deletedAt");
    expect(scheduleContinuation).toHaveBeenCalledOnce();
    expect(scheduleCleanup).not.toHaveBeenCalled();

    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(
          ctx,
          "batch-finalize-owner",
          expectedPreparation,
          scheduleCleanup,
          scheduleContinuation
        )
      )
    );
    const completed = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      transfers: await ctx.db.query("accountDeletionSchoolTransfers").collect(),
    }));

    expect(completed.owner?.deletedAt).toEqual(expect.any(Number));
    expect(completed.transfers).toEqual([]);
    expect(scheduleCleanup).toHaveBeenCalledOnce();
  });
});
