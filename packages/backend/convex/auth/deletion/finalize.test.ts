import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { finalizeAccountDeletion } from "@repo/backend/convex/auth/deletion/finalize";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  seedDeletionUser,
  seedPreparedDeletionSchool,
} from "@repo/backend/test/deletion/seed";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 6, 28, 10, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("auth/deletion/finalize", () => {
  afterEach(() => vi.useRealTimers());

  it("does not restart absent or already-running cleanup and repairs its missing receipt", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(ctx, "missing-user", undefined, scheduleCleanup)
      )
    );
    const userId = await t.mutation(async (ctx) => {
      const id = await seedDeletionUser(ctx, "started-user");
      await ctx.db.patch("users", id, { deletionCleanupStartedAt: NOW });
      return id;
    });
    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(ctx, "started-user", undefined, scheduleCleanup)
      )
    );
    await t.mutation((ctx) =>
      ctx.db.insert("accountDeletionPreparations", {
        authId: "started-user",
        userId,
        attemptId: ATTEMPT_ID,
        finalizedAt: NOW,
        recoveryGeneration: 0,
      })
    );
    await t.mutation((ctx) =>
      runConvexProgram(
        finalizeAccountDeletion(ctx, "started-user", undefined, scheduleCleanup)
      )
    );
    expect(scheduleCleanup).not.toHaveBeenCalled();
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionReceipts").unique())
    ).resolves.toMatchObject({
      attemptId: ATTEMPT_ID,
      committedAt: NOW,
    });
  });

  it("rolls back anonymization when durable cleanup scheduling fails", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      seedDeletionUser(ctx, "scheduler-failure")
    );
    const before = await t.query((ctx) => ctx.db.get("users", userId));
    const scheduleCleanup = vi.fn(() =>
      Promise.reject(new Error("scheduler offline"))
    );
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          finalizeAccountDeletion(
            ctx,
            "scheduler-failure",
            undefined,
            scheduleCleanup
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "USER_CLEANUP_FAILED", message: "scheduler offline" },
    });
    await expect(
      t.query((ctx) => ctx.db.get("users", userId))
    ).resolves.toEqual(before);
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionPreparations").collect())
    ).resolves.toEqual([]);
  });

  it("atomically transfers schools, tombstones the user, and queues cleanup", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const seeded = await t.mutation((ctx) =>
      seedPreparedDeletionSchool(ctx, "finalize-owner", NOW, ATTEMPT_ID)
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
      receipt: await ctx.db.query("accountDeletionReceipts").unique(),
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
    expect(state.receipt).toMatchObject({
      attemptId: ATTEMPT_ID,
      committedAt: expect.any(Number),
    });
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
      const result = await seedPreparedDeletionSchool(
        ctx,
        "newer-finalize-owner",
        NOW,
        ATTEMPT_ID
      );
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
      seedPreparedDeletionSchool(ctx, "requeue-finalize-owner", NOW, ATTEMPT_ID)
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
      const result = await seedPreparedDeletionSchool(
        ctx,
        "blocked-finalize-owner",
        NOW,
        ATTEMPT_ID
      );
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

  it("journals direct auth removals without a preparation", async () => {
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const userId = await t.mutation((ctx) =>
      seedDeletionUser(ctx, "direct-auth-removal")
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
      receipt: await ctx.db.query("accountDeletionReceipts").unique(),
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
    expect(state.receipt).toBeNull();
    expect(scheduleCleanup).toHaveBeenCalledWith(expect.any(Object), {
      authId: "direct-auth-removal",
      userId,
    });
  });

  it("persists the preparation version when scheduling a transfer continuation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = convexTest(schema, convexModules);
    const scheduleCleanup = vi.fn(async () => undefined);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedDeletionSchool(
        ctx,
        "scheduled-finalize-owner",
        NOW,
        ATTEMPT_ID
      );
      await ctx.db.patch("users", result.successorId, {
        deletionPreparedAt: NOW,
      });
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
          "scheduled-finalize-owner",
          expectedPreparation,
          scheduleCleanup
        )
      )
    );

    const jobs = await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(jobs).toMatchObject([
      {
        args: [{ authId: "scheduled-finalize-owner", expectedPreparation }],
        name: "customers/deletion/workflow:finalizeDeletedUserCleanup",
        scheduledTime: NOW,
        state: { kind: "pending" },
      },
    ]);
    expect(scheduleCleanup).not.toHaveBeenCalled();
    const continuation = jobs[0];
    assert(continuation);
    await t.mutation((ctx) => ctx.scheduler.cancel(continuation._id));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});
