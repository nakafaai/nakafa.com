import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import type { AudioWorkflowAudit } from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import {
  AUDITED_AUDIO_WORKFLOW_COUNT,
  AUDITED_AUDIO_WORKFLOW_FAILURE_COUNT,
  AUDITED_AUDIO_WORKFLOW_STEP_COUNT,
  AUDITED_AUDIO_WORKFLOW_SUCCESS_COUNT,
  type AuditTableName,
  CURRENT_INVENTORY,
  CUTOVER_INVENTORY_VERSION,
  EXPECTED_CURRENT_DELETIONS,
  EXPECTED_LEGACY_DELETIONS,
  LEGACY_INVENTORY,
  RETAINED_ARTIFACT_COUNT,
  RETAINED_ATTEMPT_COUNT,
  RETAINED_CATALOG_COUNT,
  RETAINED_FROZEN_PLACEMENT_COUNT,
  RETAINED_PLACEMENT_COUNT,
  RETAINED_PROGRESS_COUNT,
  RETAINED_TRYOUT_RELEASES,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import {
  CutoverProofEvidence,
  type CutoverProofEvidenceService,
  proofProgram,
} from "@repo/backend/convex/contentRelease/cutover/proof";
import type {
  CutoverProofReceipt,
  RetentionFacts,
} from "@repo/backend/convex/contentRelease/cutover/proofState";
import { RETIRED_PROGRAM_ZERO_RECEIPT } from "@repo/backend/convex/contentRelease/cutover/retiredPrograms";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  testReaderCutoverReceipt,
  testTerminalHistoryProof,
} from "@repo/backend/test/content-cutover";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const recordProofReference = makeFunctionReference<
  "mutation",
  CutoverProofReceipt,
  null
>("contentRelease/cutover/proofState:record");

describe("contentRelease/cutover/proof", () => {
  it("records the terminal phase after every exact proof passes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertCompleteCutover);
    const counted: AuditTableName[] = [];

    const receipt = await t.action((ctx) =>
      runConvexActionProgram(
        proofProgram().pipe(
          Effect.provideService(
            CutoverProofEvidence,
            makeProofEvidence(ctx, counted)
          )
        )
      )
    );

    expect(receipt).toEqual({
      artifacts: RETAINED_ARTIFACT_COUNT,
      attempts: RETAINED_ATTEMPT_COUNT,
      bundles: RETAINED_TRYOUT_RELEASES.length,
      catalogRows: RETAINED_CATALOG_COUNT,
      complete: true,
      frozenPlacements: RETAINED_FROZEN_PLACEMENT_COUNT,
      markers: RETAINED_ATTEMPT_COUNT,
      placementRows: RETAINED_PLACEMENT_COUNT,
      progressRows: RETAINED_PROGRESS_COUNT,
      snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
      snapshots: 1,
    });
    expect(counted).toEqual([
      ...LEGACY_INVENTORY.map(({ table }) => table),
      ...CURRENT_INVENTORY.map(({ table }) => table),
      "contentArtifacts",
    ]);
    await expect(
      t.run((ctx) => ctx.db.query("contentCutoverState").unique())
    ).resolves.toMatchObject({
      phase: "proved",
      provedAt: expect.any(Number),
    });
  });

  it("does not record proof when one deleted table is repopulated", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertCompleteCutover);
    const counted: AuditTableName[] = [];

    await expect(
      t.action((ctx) =>
        runConvexActionProgram(
          proofProgram().pipe(
            Effect.provideService(
              CutoverProofEvidence,
              makeProofEvidence(ctx, counted, "contentSearch")
            )
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    const state = await t.run((ctx) =>
      ctx.db.query("contentCutoverState").unique()
    );
    expect(state).toMatchObject({ phase: "complete" });
    expect(state).not.toHaveProperty("provedAt");
  });

  it("does not record proof without the retired-program zero receipt", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertCompleteCutover);

    await expect(
      t.action((ctx) =>
        runConvexActionProgram(
          proofProgram().pipe(
            Effect.provideService(
              CutoverProofEvidence,
              makeProofEvidence(ctx, [], undefined, false)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("zero receipt is missing"),
      },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentCutoverState").unique())
    ).resolves.toMatchObject({ phase: "complete" });
  });
});

function makeProofEvidence(
  ctx: ActionCtx,
  counted: AuditTableName[],
  repopulated?: AuditTableName,
  includeRetiredProgramReceipt = true
) {
  return {
    authenticateHistory: () => Effect.succeed(testTerminalHistoryProof()),
    countTable: (table) => {
      counted.push(table);
      if (table === repopulated) {
        return Effect.succeed(1);
      }
      return Effect.succeed(
        table === "contentArtifacts" ? RETAINED_ARTIFACT_COUNT : 0
      );
    },
    readRetention: () =>
      Effect.succeed(retentionFacts(includeRetiredProgramReceipt)),
    record: (receipt) =>
      callInternal(() => ctx.runMutation(recordProofReference, receipt)),
  } satisfies CutoverProofEvidenceService;
}

function retentionFacts(includeRetiredProgramReceipt: boolean): RetentionFacts {
  return {
    activity: { version: 7 },
    activityCount: 1,
    bundles: RETAINED_TRYOUT_RELEASES.map(({ manifestHash, releaseId }) => ({
      manifestHash,
      releaseId,
      snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
    })),
    contentState: 0,
    cutover: {
      audioWorkflowAudit: audioWorkflowAudit(),
      audioWorkflowAuditedAt: 2,
      audioWorkflowCleanedAt: 3,
      auditedLegacyWriteVersion: 7,
      currentDeleted: EXPECTED_CURRENT_DELETIONS,
      currentTableDeleted: 0,
      currentTableIndex: CURRENT_INVENTORY.length + 2,
      currentTablePreserved: 0,
      frozenAt: 2,
      inventoryVersion: CUTOVER_INVENTORY_VERSION,
      legacyDeleted: EXPECTED_LEGACY_DELETIONS,
      legacyTableDeleted: 0,
      legacyTableIndex: LEGACY_INVENTORY.length,
      phase: "complete",
      readerCutoverReceipt: testReaderCutoverReceipt(),
      ...(includeRetiredProgramReceipt
        ? { retiredProgramZeroReceipt: RETIRED_PROGRAM_ZERO_RECEIPT }
        : {}),
    },
    cutoverCount: 1,
    snapshots: [{ family: "tryout", snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID }],
  };
}

async function insertCompleteCutover(ctx: MutationCtx) {
  await ctx.db.insert("contentCutoverState", {
    audioWorkflowAudit: audioWorkflowAudit(),
    audioWorkflowAuditedAt: 1,
    audioWorkflowCleanedAt: 2,
    auditedActiveReleaseId: "active-release",
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 7,
    auditedNextSequence: 2,
    currentDeleted: EXPECTED_CURRENT_DELETIONS,
    currentTableDeleted: 0,
    currentTableIndex: CURRENT_INVENTORY.length + 2,
    currentTablePreserved: 0,
    frozenAt: 2,
    inventoryVersion: CUTOVER_INVENTORY_VERSION,
    key: "phase1",
    legacyDeleted: EXPECTED_LEGACY_DELETIONS,
    legacyTableDeleted: 0,
    legacyTableIndex: LEGACY_INVENTORY.length,
    phase: "complete",
    readerCutoverReceipt: testReaderCutoverReceipt(),
    retiredProgramZeroReceipt: RETIRED_PROGRAM_ZERO_RECEIPT,
    updatedAt: 3,
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
