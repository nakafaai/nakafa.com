import type { WorkflowId } from "@convex-dev/workflow";
import {
  cleanupDeletedUserWorkflowStorageProgram,
  retryDeletedUserCleanupProgram,
} from "@repo/backend/convex/customers/deletion/recovery";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

describe("customers/deletion/recovery", () => {
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
