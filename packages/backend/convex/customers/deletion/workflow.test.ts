import type { WorkflowId } from "@convex-dev/workflow";
import {
  cleanupDeletedUserWorkflowStorageProgram,
  launchDeletedUserCleanupProgram,
  retryDeletedUserCleanupProgram,
} from "@repo/backend/convex/customers/deletion/workflow";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

describe("customers/deletion/workflow", () => {
  it("starts cleanup for the matching app user", async () => {
    const t = convexTest(schema, convexModules);
    const startAnalytics = vi.fn(async () => undefined);
    const startData = vi.fn(async () => undefined);
    const deletedAt = Date.now();

    const user = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "deleted-auth-user",
        credits: 0,
        creditsResetAt: 0,
        deletedAt,
        email: "deleted@example.com",
        name: "Deleted User",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        authId: "deleted-auth-user",
        finalizedAt: Date.now(),
        recoveryGeneration: 0,
        userId: insertedUserId,
      });

      await runConvexProgram(
        launchDeletedUserCleanupProgram(
          ctx,
          "deleted-auth-user",
          insertedUserId,
          { startAnalytics, startData }
        )
      );

      return await ctx.db.get("users", insertedUserId);
    });

    expect(user?.deletionCleanupStartedAt).toEqual(expect.any(Number));
    expect(startAnalytics).toHaveBeenCalledOnce();
    expect(startData).toHaveBeenCalledOnce();
    const expectedIdentity = {
      authId: "deleted-auth-user",
      userId: user?._id,
    };
    expect(startAnalytics).toHaveBeenCalledWith(
      expect.any(Object),
      expectedIdentity
    );
    expect(startData).toHaveBeenCalledWith(
      expect.any(Object),
      expectedIdentity
    );
  });

  it("does nothing when the app user is already absent", async () => {
    const t = convexTest(schema, convexModules);
    const startAnalytics = vi.fn(async () => undefined);
    const startData = vi.fn(async () => undefined);
    const missingUserId = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "removed-auth-user",
        credits: 0,
        creditsResetAt: 0,
        email: "removed@example.com",
        name: "Removed User",
        plan: "free",
      });
      await ctx.db.delete("users", userId);
      return userId;
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        launchDeletedUserCleanupProgram(
          ctx,
          "missing-auth-user",
          missingUserId,
          { startAnalytics, startData }
        )
      )
    );

    expect(startAnalytics).not.toHaveBeenCalled();
    expect(startData).not.toHaveBeenCalled();
  });

  it("returns a typed failure when either workflow cannot start", async () => {
    const t = convexTest(schema, convexModules);
    const startAnalytics = vi.fn(async () => undefined);
    const startData = vi.fn(async () =>
      Promise.reject(new Error("workflow unavailable"))
    );
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "failing-auth-user",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: Date.now(),
        email: "failing@example.com",
        name: "Failing User",
        plan: "free",
      })
    );

    await expect(
      t.mutation(
        async (ctx) =>
          await runConvexProgram(
            launchDeletedUserCleanupProgram(ctx, "failing-auth-user", userId, {
              startAnalytics,
              startData,
            })
          )
      )
    ).rejects.toMatchObject({
      data: {
        code: "USER_CLEANUP_FAILED",
        message: "workflow unavailable",
      },
    });

    const user = await t.query(async (ctx) => await ctx.db.get(userId));

    expect(startAnalytics).toHaveBeenCalledOnce();
    expect(startData).toHaveBeenCalledOnce();
    expect(user).not.toHaveProperty("deletionCleanupStartedAt");
  });

  it("restarts a retained failed cleanup asynchronously", async () => {
    const t = convexTest(schema, convexModules);
    const workflowId = "failed-workflow" as WorkflowId;
    const getStatus = vi.fn(async () => ({
      error: "PostHog unavailable",
      type: "failed" as const,
    }));
    const restartWorkflow = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        retryDeletedUserCleanupProgram(
          ctx,
          workflowId,
          getStatus,
          restartWorkflow
        )
      )
    );

    expect(getStatus).toHaveBeenCalledWith(expect.any(Object), workflowId);
    expect(restartWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      workflowId,
      { from: 0, startAsync: true }
    );
  });

  it("restarts a retained canceled cleanup asynchronously", async () => {
    const t = convexTest(schema, convexModules);
    const workflowId = "canceled-workflow" as WorkflowId;
    const getStatus = vi.fn(async () => ({
      type: "canceled" as const,
    }));
    const restartWorkflow = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        retryDeletedUserCleanupProgram(
          ctx,
          workflowId,
          getStatus,
          restartWorkflow
        )
      )
    );

    expect(restartWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      workflowId,
      { from: 0, startAsync: true }
    );
  });

  it("does not restart a cleanup that already completed", async () => {
    const t = convexTest(schema, convexModules);
    const workflowId = "completed-workflow" as WorkflowId;
    const getStatus = vi.fn(async () => ({
      result: null,
      type: "completed" as const,
    }));
    const restartWorkflow = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        retryDeletedUserCleanupProgram(
          ctx,
          workflowId,
          getStatus,
          restartWorkflow
        )
      )
    );

    expect(restartWorkflow).not.toHaveBeenCalled();
  });

  it("requeues recovery when a retained workflow cannot be inspected", async () => {
    const t = convexTest(schema, convexModules);
    const workflowId = "unavailable-workflow" as WorkflowId;
    const getStatus = vi.fn(async () =>
      Promise.reject(new Error("workflow status unavailable"))
    );
    const restartWorkflow = vi.fn(async () => undefined);
    const scheduleRecovery = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        retryDeletedUserCleanupProgram(
          ctx,
          workflowId,
          getStatus,
          restartWorkflow,
          scheduleRecovery
        )
      )
    );

    expect(restartWorkflow).not.toHaveBeenCalled();
    expect(scheduleRecovery).toHaveBeenCalledWith(
      expect.any(Object),
      workflowId
    );
  });

  it("requeues recovery when a retained workflow cannot restart", async () => {
    const t = convexTest(schema, convexModules);
    const workflowId = "restart-failed-workflow" as WorkflowId;
    const getStatus = vi.fn(async () => ({
      error: "PostHog unavailable",
      type: "failed" as const,
    }));
    const restartWorkflow = vi.fn(async () =>
      Promise.reject(new Error("workflow restart unavailable"))
    );
    const scheduleRecovery = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        retryDeletedUserCleanupProgram(
          ctx,
          workflowId,
          getStatus,
          restartWorkflow,
          scheduleRecovery
        )
      )
    );

    expect(scheduleRecovery).toHaveBeenCalledWith(
      expect.any(Object),
      workflowId
    );
  });

  it("requeues journal cleanup when workflow storage is unavailable", async () => {
    const t = convexTest(schema, convexModules);
    const workflowId = "cleanup-unavailable-workflow" as WorkflowId;
    const cleanupStorage = vi.fn(async () =>
      Promise.reject(new Error("workflow storage unavailable"))
    );
    const scheduleRecovery = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        cleanupDeletedUserWorkflowStorageProgram(
          ctx,
          workflowId,
          cleanupStorage,
          scheduleRecovery
        )
      )
    );

    expect(cleanupStorage).toHaveBeenCalledWith(expect.any(Object), workflowId);
    expect(scheduleRecovery).toHaveBeenCalledWith(
      expect.any(Object),
      workflowId
    );
  });

  it("does not requeue journal cleanup after storage is released", async () => {
    const t = convexTest(schema, convexModules);
    const workflowId = "cleanup-complete-workflow" as WorkflowId;
    const cleanupStorage = vi.fn(async () => undefined);
    const scheduleRecovery = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        cleanupDeletedUserWorkflowStorageProgram(
          ctx,
          workflowId,
          cleanupStorage,
          scheduleRecovery
        )
      )
    );

    expect(cleanupStorage).toHaveBeenCalledWith(expect.any(Object), workflowId);
    expect(scheduleRecovery).not.toHaveBeenCalled();
  });
});
