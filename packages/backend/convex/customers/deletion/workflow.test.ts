import type { WorkflowId } from "@convex-dev/workflow";
import {
  retryDeletedUserCleanupProgram,
  startDeletedUserCleanupProgram,
} from "@repo/backend/convex/customers/deletion/workflow";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

describe("customers/deletion/workflow", () => {
  it("starts cleanup for the matching app user", async () => {
    const t = convexTest(schema, convexModules);
    const startWorkflow = vi.fn(async () => undefined);

    const user = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "deleted-auth-user",
        credits: 0,
        creditsResetAt: 0,
        email: "deleted@example.com",
        name: "Deleted User",
        plan: "free",
      });

      await runConvexProgram(
        startDeletedUserCleanupProgram(ctx, "deleted-auth-user", startWorkflow)
      );

      return await ctx.db.get("users", insertedUserId);
    });

    expect(user?.deletedAt).toEqual(expect.any(Number));
    expect(startWorkflow).toHaveBeenCalledOnce();
    expect(startWorkflow).toHaveBeenCalledWith(expect.any(Object), {
      authId: "deleted-auth-user",
      userId: user?._id,
    });
  });

  it("does nothing when the app user is already absent", async () => {
    const t = convexTest(schema, convexModules);
    const startWorkflow = vi.fn(async () => undefined);

    await t.mutation((ctx) =>
      runConvexProgram(
        startDeletedUserCleanupProgram(ctx, "missing-auth-user", startWorkflow)
      )
    );

    expect(startWorkflow).not.toHaveBeenCalled();
  });

  it("returns a typed failure when the workflow cannot start", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "failing-auth-user",
        credits: 0,
        creditsResetAt: 0,
        email: "failing@example.com",
        name: "Failing User",
        plan: "free",
      })
    );

    await expect(
      t.mutation(
        async (ctx) =>
          await runConvexProgram(
            startDeletedUserCleanupProgram(
              ctx,
              "failing-auth-user",
              async () =>
                await Promise.reject(new Error("workflow unavailable"))
            )
          )
      )
    ).rejects.toMatchObject({
      data: {
        code: "USER_CLEANUP_FAILED",
        message: "workflow unavailable",
      },
    });

    const user = await t.query(async (ctx) => await ctx.db.get(userId));

    expect(user).not.toHaveProperty("deletedAt");
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

  it("does not restart a cleanup that is no longer failed", async () => {
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
});
