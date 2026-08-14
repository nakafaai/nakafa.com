import {
  CUTOVER_AUDIO_WORKFLOW_COUNTS,
  CUTOVER_REFERENCE_PROOF_COUNTS,
} from "@repo/backend/convex/contentRelease/cutover/evidence";
import { RETIRED_PROGRAM_ZERO_RECEIPT_VERSION } from "@repo/backend/convex/contentRelease/cutover/schema";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  buildRuntimeGenerations,
  formatGenerationEnvironment,
} from "@repo/backend/scripts/content-runtime/ci/generation";
import { verifyProvedMaintenance } from "@repo/backend/scripts/content-runtime/ci/maintenance";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const makeMaintenance = () => {
  const currentRelease = retainedTryoutHistoryPlan.releases.at(-1);
  if (!currentRelease) {
    throw new Error("Expected retained current release fixture.");
  }

  return {
    contentCutoverActivity: [
      {
        _creationTime: 1,
        _id: "activity-1",
        key: "legacy",
        updatedAt: 5,
        version: 0,
      },
    ],
    contentCutoverState: [
      {
        _creationTime: 1,
        _id: "checkpoint-1",
        articleReferenceProof: {
          count: CUTOVER_REFERENCE_PROOF_COUNTS.article,
          provedAt: 9,
        },
        audioWorkflowAudit: {
          ...CUTOVER_AUDIO_WORKFLOW_COUNTS,
          workflows: Array.from(
            { length: CUTOVER_AUDIO_WORKFLOW_COUNTS.total },
            (_, index) => {
              const result =
                index < CUTOVER_AUDIO_WORKFLOW_COUNTS.succeeded
                  ? "success"
                  : "failed";
              return {
                id: `workflow-${index}`,
                result,
                steps: 5,
              };
            }
          ),
        },
        audioWorkflowAuditedAt: 6,
        audioWorkflowCleanedAt: 7,
        auditedActiveReleaseId: currentRelease.releaseId,
        auditedActiveSequence: 25,
        auditedAt: 10,
        auditedLegacyWriteVersion: 0,
        auditedNextSequence: 27,
        currentDeleted: 22_954,
        currentTableDeleted: 0,
        currentTableIndex: 24,
        currentTablePreserved: 0,
        frozenAt: 20,
        inventoryVersion: "production-2026-08-13",
        key: "phase1",
        legacyDeleted: 12_854,
        legacyTableDeleted: 0,
        legacyTableIndex: 16,
        materialReferenceProof: {
          count: CUTOVER_REFERENCE_PROOF_COUNTS.material,
          provedAt: 9,
        },
        materialTopicReferenceProof: {
          count: CUTOVER_REFERENCE_PROOF_COUNTS.materialTopic,
          provedAt: 9,
        },
        phase: "proved",
        provedAt: 30,
        quranReferenceProof: {
          count: CUTOVER_REFERENCE_PROOF_COUNTS.quran,
          provedAt: 9,
        },
        readerCutoverReceipt: {
          acceptedAt: 8,
          history: {
            attempts: retainedTryoutHistoryPlan.attemptCount,
            declaredFrozenPlacements:
              retainedTryoutHistoryPlan.frozenPlacementCount,
            markers: retainedTryoutHistoryPlan.attemptCount,
            releases: retainedTryoutHistoryPlan.releases.map((release) => ({
              attempts: release.attemptCount,
              releaseId: release.releaseId,
            })),
            snapshotId: retainedTryoutHistoryPlan.snapshotId,
          },
          referenceProofs: CUTOVER_REFERENCE_PROOF_COUNTS,
        },
        retiredProgramZeroReceipt: {
          learningPlanItems: 0,
          learningPlans: 0,
          learningProfiles: 0,
          learningProgramCoverage: 0,
          learningProgramSources: 0,
          learningPrograms: 0,
          version: RETIRED_PROGRAM_ZERO_RECEIPT_VERSION,
        },
        tryoutReferenceProof: {
          count: CUTOVER_REFERENCE_PROOF_COUNTS.tryout,
          provedAt: 9,
        },
        updatedAt: 30,
      },
    ],
    contentState: [],
  };
};

const expectMaintenanceFailure = async (
  input: Parameters<typeof verifyProvedMaintenance>[0]
) => {
  await expect(
    Effect.runPromise(verifyProvedMaintenance(input).pipe(Effect.flip))
  ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });
};

describe("content runtime proved maintenance", () => {
  it("authenticates and hashes the exact terminal checkpoint", async () => {
    const input = makeMaintenance();
    const verified = await Effect.runPromise(verifyProvedMaintenance(input));
    const baseline = await Effect.runPromise(
      buildRuntimeGenerations(
        input.contentState,
        input.contentCutoverState,
        input.contentCutoverActivity
      )
    );
    const activity = input.contentCutoverActivity[0];
    if (!activity) {
      throw new Error("Expected maintenance activity fixture.");
    }
    const changed = await Effect.runPromise(
      buildRuntimeGenerations(input.contentState, input.contentCutoverState, [
        { ...activity, updatedAt: activity.updatedAt + 1 },
      ])
    );

    expect(verified).toBe(input);
    expect(baseline.mode).toBe("proved-maintenance");
    expect(changed.runtimeGenerationHash).not.toBe(
      baseline.runtimeGenerationHash
    );
    expect(formatGenerationEnvironment(baseline)).toBe(
      [
        "AGENT_DOCS_CONTENT_RUNTIME_MODE=proved-maintenance",
        `AGENT_DOCS_RUNTIME_GENERATION_HASH=${baseline.runtimeGenerationHash}`,
      ].join("\n")
    );
  });

  it("ignores only Convex system fields in the maintenance hash", async () => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    const activity = input.contentCutoverActivity[0];
    if (!(checkpoint && activity)) {
      throw new Error("Expected maintenance row fixtures.");
    }
    const baseline = await Effect.runPromise(
      buildRuntimeGenerations(
        input.contentState,
        input.contentCutoverState,
        input.contentCutoverActivity
      )
    );
    const changed = await Effect.runPromise(
      buildRuntimeGenerations(
        [],
        [{ ...checkpoint, _creationTime: 99, _id: "checkpoint-other" }],
        [{ ...activity, _creationTime: 99, _id: "activity-other" }]
      )
    );

    expect(changed).toEqual(baseline);
  });

  it("rejects missing or duplicate maintenance rows and a live pointer", async () => {
    const input = makeMaintenance();
    await expectMaintenanceFailure({ ...input, contentCutoverState: [] });
    await expectMaintenanceFailure({ ...input, contentCutoverActivity: [] });
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        ...input.contentCutoverState,
        ...input.contentCutoverState,
      ],
    });
    await expectMaintenanceFailure({
      ...input,
      contentCutoverActivity: [
        ...input.contentCutoverActivity,
        ...input.contentCutoverActivity,
      ],
    });
    await expectMaintenanceFailure({
      ...input,
      contentState: [{ key: "primary" }],
    });
  });

  it.each([
    ["checkpoint key", { key: "other" }],
    ["phase", { phase: "complete" }],
    ["inventory", { inventoryVersion: "other" }],
    ["active sequence", { auditedActiveSequence: 24 }],
    ["next sequence", { auditedNextSequence: 26 }],
    ["legacy write version", { auditedLegacyWriteVersion: 1 }],
    ["drain total", { currentDeleted: 22_953 }],
    ["current table deletion", { currentTableDeleted: 1 }],
    ["table index", { currentTableIndex: 23 }],
    ["preserved rows", { currentTablePreserved: 1 }],
    ["legacy drain total", { legacyDeleted: 12_853 }],
    ["legacy table deletion", { legacyTableDeleted: 1 }],
    ["legacy table index", { legacyTableIndex: 15 }],
  ])("rejects a wrong %s", async (_label, patch) => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    if (!checkpoint) {
      throw new Error("Expected maintenance checkpoint fixture.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [{ ...checkpoint, ...patch }],
    });
  });

  it("rejects missing terminal fields", async () => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    if (!checkpoint) {
      throw new Error("Expected maintenance checkpoint fixture.");
    }
    const {
      frozenAt: _frozenAt,
      retiredProgramZeroReceipt: _retiredProgramZeroReceipt,
      ...withoutTerminalFields
    } = checkpoint;
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [withoutTerminalFields],
    });
  });

  it.each([
    ["current drain", { currentCursor: "cursor" }],
    ["material proof", { materialReferenceProgress: { checked: 1 } }],
    ["Quran proof", { quranReferenceProgress: { checked: 1 } }],
  ])("rejects an incomplete %s cursor", async (_label, patch) => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    if (!checkpoint) {
      throw new Error("Expected maintenance checkpoint fixture.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [{ ...checkpoint, ...patch }],
    });
  });

  it("rejects an unexpected persisted field", async () => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    if (!checkpoint) {
      throw new Error("Expected maintenance checkpoint fixture.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [{ ...checkpoint, unexpected: "field" }],
    });
  });

  it("rejects terminal identity and activity drift", async () => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    const activity = input.contentCutoverActivity[0];
    if (!(checkpoint && activity)) {
      throw new Error("Expected maintenance row fixtures.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        { ...checkpoint, auditedActiveReleaseId: "other-release" },
      ],
    });
    await expectMaintenanceFailure({
      ...input,
      contentCutoverActivity: [
        { ...activity, updatedAt: checkpoint.auditedAt + 1 },
      ],
    });
    await expectMaintenanceFailure({
      ...input,
      contentCutoverActivity: [{ ...activity, version: 1 }],
    });
  });

  it("rejects retained history, reference, and audio receipt drift", async () => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    if (!checkpoint) {
      throw new Error("Expected maintenance checkpoint fixture.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        {
          ...checkpoint,
          readerCutoverReceipt: {
            ...checkpoint.readerCutoverReceipt,
            history: {
              ...checkpoint.readerCutoverReceipt.history,
              snapshotId: "sha256:other",
            },
          },
        },
      ],
    });
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        {
          ...checkpoint,
          articleReferenceProof: {
            ...checkpoint.articleReferenceProof,
            count: 1,
          },
        },
      ],
    });
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        {
          ...checkpoint,
          readerCutoverReceipt: {
            ...checkpoint.readerCutoverReceipt,
            referenceProofs: {
              ...checkpoint.readerCutoverReceipt.referenceProofs,
              article: 1,
            },
          },
        },
      ],
    });
    const workflows = checkpoint.audioWorkflowAudit.workflows.map(
      (workflow, index) =>
        index === 1 ? { ...workflow, id: "workflow-0" } : workflow
    );
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        {
          ...checkpoint,
          audioWorkflowAudit: {
            ...checkpoint.audioWorkflowAudit,
            workflows,
          },
        },
      ],
    });
    const wrongStepCount = checkpoint.audioWorkflowAudit.workflows.map(
      (workflow, index) => {
        if (index === 0) {
          return { ...workflow, steps: workflow.steps - 1 };
        }
        if (index === 1) {
          return { ...workflow, steps: workflow.steps + 1 };
        }
        return workflow;
      }
    );
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        {
          ...checkpoint,
          audioWorkflowAudit: {
            ...checkpoint.audioWorkflowAudit,
            workflows: wrongStepCount,
          },
        },
      ],
    });
  });

  it.each([
    ["audit after freeze", { auditedAt: 21 }],
    ["freeze after proof", { frozenAt: 31 }],
    ["updated time drift", { updatedAt: 29 }],
    ["audio audit after cleanup", { audioWorkflowAuditedAt: 8 }],
    ["audio cleanup after proof", { audioWorkflowCleanedAt: 31 }],
    [
      "reference after proof",
      { articleReferenceProof: { count: 14, provedAt: 31 } },
    ],
  ])("rejects %s", async (_label, patch) => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    if (!checkpoint) {
      throw new Error("Expected maintenance checkpoint fixture.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [{ ...checkpoint, ...patch }],
    });
  });

  it("rejects zero checkpoint and activity timestamps", async () => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    const activity = input.contentCutoverActivity[0];
    if (!(checkpoint && activity)) {
      throw new Error("Expected maintenance row fixtures.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        {
          ...checkpoint,
          articleReferenceProof: {
            ...checkpoint.articleReferenceProof,
            provedAt: 0,
          },
        },
      ],
    });
    await expectMaintenanceFailure({
      ...input,
      contentCutoverActivity: [{ ...activity, updatedAt: 0 }],
    });
  });

  it("rejects reader acceptance after terminal proof", async () => {
    const input = makeMaintenance();
    const checkpoint = input.contentCutoverState[0];
    if (!checkpoint) {
      throw new Error("Expected maintenance checkpoint fixture.");
    }
    await expectMaintenanceFailure({
      ...input,
      contentCutoverState: [
        {
          ...checkpoint,
          readerCutoverReceipt: {
            ...checkpoint.readerCutoverReceipt,
            acceptedAt: checkpoint.provedAt + 1,
          },
        },
      ],
    });
  });
});
