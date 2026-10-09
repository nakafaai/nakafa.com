import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
// @vitest-environment node

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { requestAnalyticsErasure } from "@repo/backend/confect/analytics/erasure/request";
import {
  cleanupWorkflowStorageProgram,
  retryCleanupWorkflowProgram,
  WORKFLOW_RECOVERY_DELAY_MS,
} from "@repo/backend/confect/privacy/recovery";
import { cleanupSource } from "@repo/backend/confect/privacy/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { registerWorkflow } from "@repo/backend/test/workflow";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Data, DateTime, Effect, MutableRef } from "effect";

const NOW = Date.UTC(2026, 8, 27);
class WorkflowUnavailable extends Data.TaggedError("WorkflowUnavailable")<{
  readonly message: string;
}> {}
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(NOW);
  vi.stubEnv("POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubEnv("POSTHOG_PROJECT_ID", "114144");
  vi.stubEnv("POSTHOG_ERASURE_API_KEY", "test-erasure-key");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function admit() {
  const sent = MutableRef.make<
    readonly { body: string; method: string; url: string }[]
  >([]);
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const request = new Request(input, init);
      const body = await request.text();
      MutableRef.update(
        sent,
        Arr.append({ body, method: request.method, url: request.url })
      );
      return Response.json({
        deletion_errors: [],
        events_queued_for_deletion: true,
        persons_deleted: 1,
        persons_found: 1,
        recordings_queued_for_deletion: true,
      });
    })
  );
  const t = createConvexTestWithBetterAuth();
  await registerWorkflow(t);
  const userId = await t.mutation((ctx) =>
    ctx.db.insert("users", {
      authId: "privacy-recovery-user",
      credits: 0,
      creditsResetAt: NOW,
      email: "privacy-recovery@example.invalid",
      name: "Privacy recovery",
      plan: "free",
    })
  );
  await t.action((ctx) =>
    Effect.runPromise(
      requestAnalyticsErasure(userId).pipe(
        Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
      )
    )
  );
  const admitted = await t.query((ctx) => workflow.list(ctx));
  const journal = admitted.page[0];
  assert(journal);
  return {
    t,
    requests: () => MutableRef.get(sent),
    userId,
    workflowId: journal.workflowId,
  };
}
async function failWorkflow(fixture: Awaited<ReturnType<typeof admit>>) {
  const { t, workflowId } = fixture;
  const state = await t.query((ctx) =>
    ctx.runQuery(components.workflow.workflow.getStatus, {
      workflowId,
    })
  );
  await t.mutation((ctx) =>
    ctx.runMutation(components.workflow.workflow.complete, {
      generationNumber: state.workflow.generationNumber,
      runResult: {
        kind: "failed",
        error: "Temporary external erasure failure",
      },
      workflowId,
    })
  );
}
async function readJobs(
  fixture: Awaited<ReturnType<typeof admit>>,
  name: string
) {
  return Arr.filter(
    await fixture.t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    ),
    (job) => job.name === `privacy/recovery:${name}`
  );
}
async function expectErased(fixture: Awaited<ReturnType<typeof admit>>) {
  expect(fixture.requests()).toEqual([
    {
      body: encodeJsonText({
        delete_events: true,
        delete_recordings: true,
        distinct_ids: [fixture.userId],
        keep_person: false,
      }),
      method: "POST",
      url: "https://eu.posthog.com/api/projects/114144/persons/bulk_delete/",
    },
  ]);
  expect((await fixture.t.query((ctx) => workflow.list(ctx))).page).toEqual([]);
}
describe("privacy workflow recovery", () => {
  it("executes durable erasure and releases the successful journal", async () => {
    const fixture = await admit();
    await fixture.t.finishAllScheduledFunctions(vi.runAllTimers);
    await expectErased(fixture);
    expect(await readJobs(fixture, "cleanupWorkflowStorage")).toEqual([
      expect.objectContaining({
        state: {
          kind: "success",
        },
      }),
    ]);
    await fixture.t.mutation(internal.privacy.recovery.cleanupWorkflowStorage, {
      workflowId: fixture.workflowId,
      source: cleanupSource.consentOverlap,
    });
    expect(await readJobs(fixture, "cleanupWorkflowStorage")).toHaveLength(1);
  });
  it.each(["failed", "canceled"] as const)(
    "restarts a %s workflow after its recovery delay and completes erasure",
    async (status) => {
      const fixture = await admit();
      if (status === "failed") {
        await failWorkflow(fixture);
      } else {
        await fixture.t.mutation((ctx) =>
          workflow.cancel(ctx, fixture.workflowId)
        );
      }
      expect(
        await fixture.t.query((ctx) => workflow.status(ctx, fixture.workflowId))
      ).toMatchObject({
        type: status,
      });
      await fixture.t.finishAllScheduledFunctions(vi.runAllTimers);
      await expectErased(fixture);
      expect(await readJobs(fixture, "retryCleanupWorkflow")).toEqual([
        expect.objectContaining({
          scheduledTime: NOW + WORKFLOW_RECOVERY_DELAY_MS,
          state: {
            kind: "success",
          },
        }),
      ]);
    }
  );
  it.each(["status", "restart"] as const)(
    "retains and retries recovery when Workflow %s is temporarily unavailable",
    async (operation) => {
      const fixture = await admit();
      await failWorkflow(fixture);
      vi.spyOn(workflow, operation).mockRejectedValueOnce(
        new WorkflowUnavailable({
          message: "component unavailable",
        })
      );
      await fixture.t.finishAllScheduledFunctions(vi.runAllTimers);
      await expectErased(fixture);
      const jobs = await readJobs(fixture, "retryCleanupWorkflow");
      expect(Arr.map(jobs, (job) => job.scheduledTime)).toEqual([
        NOW + WORKFLOW_RECOVERY_DELAY_MS,
        NOW + 2 * WORKFLOW_RECOVERY_DELAY_MS,
      ]);
      expect(Arr.every(jobs, (job) => job.state.kind === "success")).toBe(true);
    }
  );
  it("retries journal release without rerunning external erasure", async () => {
    const fixture = await admit();
    let failedAt: number | undefined;
    vi.spyOn(workflow, "cleanup").mockImplementationOnce(() => {
      failedAt = DateTime.toEpochMillis(DateTime.nowUnsafe());
      return Promise.reject(
        new WorkflowUnavailable({
          message: "component unavailable",
        })
      );
    });
    await fixture.t.finishAllScheduledFunctions(vi.runAllTimers);
    await expectErased(fixture);
    const jobs = await readJobs(fixture, "cleanupWorkflowStorage");
    expect(jobs).toHaveLength(2);
    assert(failedAt !== undefined);
    expect(jobs[1]?.scheduledTime).toBe(failedAt + WORKFLOW_RECOVERY_DELAY_MS);
    expect(Arr.every(jobs, (job) => job.state.kind === "success")).toBe(true);
  });
  it.each(["recovery", "journal"] as const)(
    "preserves the journal and reports a typed failure when %s cannot be rescheduled",
    async (operation) => {
      const fixture = await admit();
      await failWorkflow(fixture);
      vi.spyOn(
        workflow,
        operation === "recovery" ? "status" : "cleanup"
      ).mockRejectedValueOnce(
        new WorkflowUnavailable({
          message: "component unavailable",
        })
      );
      await expect(
        fixture.t.mutation((ctx) => {
          vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValueOnce(
            new WorkflowUnavailable({
              message: "scheduler unavailable",
            })
          );
          return Effect.runPromise(
            (operation === "recovery"
              ? retryCleanupWorkflowProgram
              : cleanupWorkflowStorageProgram)(
              fixture.workflowId,
              cleanupSource.consentOverlap
            ).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          );
        })
      ).rejects.toMatchObject({
        code: "PRIVACY_CLEANUP_FAILED",
        message: "scheduler unavailable",
      });
      expect(
        (await fixture.t.query((ctx) => workflow.list(ctx))).page
      ).toHaveLength(1);
      await fixture.t.finishAllScheduledFunctions(vi.runAllTimers);
      await expectErased(fixture);
    }
  );
  it("does not restart a workflow whose successful result is already committed", async () => {
    const fixture = await admit();
    const { t, workflowId } = fixture;
    const state = await t.query((ctx) =>
      ctx.runQuery(components.workflow.workflow.getStatus, {
        workflowId,
      })
    );
    await t.mutation((ctx) =>
      ctx.runMutation(components.workflow.workflow.complete, {
        generationNumber: state.workflow.generationNumber,
        runResult: {
          kind: "success",
          returnValue: null,
        },
        workflowId,
      })
    );
    await t.mutation(internal.privacy.recovery.retryCleanupWorkflow, {
      workflowId,
      source: cleanupSource.consentOverlap,
    });
    const after = await t.query((ctx) =>
      ctx.runQuery(components.workflow.workflow.getStatus, {
        workflowId,
      })
    );
    expect(after.workflow.generationNumber).toBe(
      state.workflow.generationNumber
    );
    expect(after.workflow.runResult).toEqual({
      kind: "success",
      returnValue: null,
    });
    expect(await readJobs(fixture, "retryCleanupWorkflow")).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.query((ctx) => workflow.list(ctx))).page).toEqual([]);
  });
});
