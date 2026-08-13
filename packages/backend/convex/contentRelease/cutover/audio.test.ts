import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { AudioWorkflowAudit } from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import {
  AUDITED_AUDIO_WORKFLOW_COUNT,
  AUDITED_AUDIO_WORKFLOW_FAILURE_COUNT,
  AUDITED_AUDIO_WORKFLOW_STEP_COUNT,
  AUDITED_AUDIO_WORKFLOW_SUCCESS_COUNT,
  CUTOVER_INVENTORY_VERSION,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const checkpoint = makeFunctionReference<
  "query",
  Record<string, never>,
  { audit?: AudioWorkflowAudit; cleanedAt?: number }
>("contentRelease/cutover/audio:checkpoint");
const recordAudit = makeFunctionReference<
  "mutation",
  { audit: AudioWorkflowAudit },
  null
>("contentRelease/cutover/audio:recordAudit");
const recordCleanup = makeFunctionReference<
  "mutation",
  Record<string, never>,
  null
>("contentRelease/cutover/audio:recordCleanup");
describe("contentRelease/cutover/audio", () => {
  it("persists the exact audit and terminal cleanup marker idempotently", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertQuiescentCutover);
    const audit = audioWorkflowAudit();

    await expect(t.mutation(recordAudit, { audit })).resolves.toBeNull();
    await expect(t.mutation(recordAudit, { audit })).resolves.toBeNull();
    await expect(t.mutation(recordCleanup, {})).resolves.toBeNull();
    await expect(t.mutation(recordCleanup, {})).resolves.toBeNull();
    await expect(t.query(checkpoint, {})).resolves.toMatchObject({
      audit,
      cleanedAt: expect.any(Number),
    });
  });

  it("rejects noncanonical or internally inconsistent audit receipts", async () => {
    const exactAudit = audioWorkflowAudit();
    const duplicateIdentity = {
      ...exactAudit,
      workflows: exactAudit.workflows.map((row, index) =>
        index === 1 ? { ...row, id: "audio-workflow-000" } : row
      ),
    };
    const wrongStepSum = {
      ...exactAudit,
      workflows: exactAudit.workflows.map((row, index) =>
        index === 0 ? { ...row, steps: row.steps - 1 } : row
      ),
    };
    const wrongResultCount = {
      ...exactAudit,
      workflows: exactAudit.workflows.map((row, index) =>
        index === 0 ? failAudioWorkflow(row) : row
      ),
    };

    for (const audit of [duplicateIdentity, wrongStepSum, wrongResultCount]) {
      const t = convexTest(schema, convexModules);
      await t.mutation(insertQuiescentCutover);
      await expect(t.mutation(recordAudit, { audit })).rejects.toThrow(
        "Audio workflow cutover"
      );
    }
  });
});

async function insertQuiescentCutover(ctx: MutationCtx) {
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: "active-release",
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: 2,
    currentDeleted: 0,
    currentTableDeleted: 0,
    currentTableIndex: 0,
    currentTablePreserved: 0,
    inventoryVersion: CUTOVER_INVENTORY_VERSION,
    key: "phase1",
    legacyDeleted: 0,
    legacyTableDeleted: 0,
    legacyTableIndex: 0,
    phase: "quiescent",
    updatedAt: 1,
  });
}

function audioWorkflowAudit(): AudioWorkflowAudit {
  return {
    failed: AUDITED_AUDIO_WORKFLOW_FAILURE_COUNT,
    steps: AUDITED_AUDIO_WORKFLOW_STEP_COUNT,
    succeeded: AUDITED_AUDIO_WORKFLOW_SUCCESS_COUNT,
    total: AUDITED_AUDIO_WORKFLOW_COUNT,
    workflows: Array.from(
      { length: AUDITED_AUDIO_WORKFLOW_COUNT },
      (_, index) => ({
        id: `audio-workflow-${index.toString().padStart(3, "0")}`,
        result:
          index < AUDITED_AUDIO_WORKFLOW_SUCCESS_COUNT ? "success" : "failed",
        steps: 5,
      })
    ),
  };
}

function failAudioWorkflow(
  workflow: AudioWorkflowAudit["workflows"][number]
): AudioWorkflowAudit["workflows"][number] {
  return { ...workflow, result: "failed" };
}
