import { vWorkflowId } from "@convex-dev/workflow";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { WORKFLOW_RECOVERY_DELAY_MS } from "@repo/backend/confect/privacy/recovery";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { parse } from "convex-helpers/validators";

const NOW = Date.UTC(2026, 8, 27);
const workflowId = parse(vWorkflowId, "privacy-completion-test");

afterEach(() => vi.useRealTimers());

describe("privacy workflow completion", () => {
  it.each([
    { kind: "success", returnValue: null },
    { kind: "failed", error: "External erasure temporarily unavailable" },
    { kind: "canceled" },
  ] as const)("schedules the durable next step for $kind", async (result) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTestWithBetterAuth();
    await t.mutation(internal.privacy.recovery.handleCleanupComplete, {
      context: { source: "account-deletion" },
      result,
      workflowId,
    });
    const jobs = await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(jobs).toEqual([
      expect.objectContaining({
        args: [{ source: "account-deletion", workflowId }],
        name:
          result.kind === "success"
            ? "privacy/recovery:cleanupWorkflowStorage"
            : "privacy/recovery:retryCleanupWorkflow",
        scheduledTime:
          result.kind === "success" ? NOW : NOW + WORKFLOW_RECOVERY_DELAY_MS,
        state: { kind: "pending" },
      }),
    ]);
  });
});
