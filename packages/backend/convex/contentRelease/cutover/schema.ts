import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { historyMarkerProofValidator } from "@repo/backend/convex/tryouts/history/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const cutoverPhaseValidator = literals(
  "quiescent",
  "audited",
  "draining-legacy",
  "legacy-drained",
  "freeze-armed",
  "frozen",
  "draining-current",
  "complete",
  "proved"
);

export const audioWorkflowAuditValidator = v.object({
  failed: v.number(),
  steps: v.number(),
  succeeded: v.number(),
  total: v.number(),
  workflows: v.array(
    v.object({
      id: v.string(),
      result: v.union(v.literal("failed"), v.literal("success")),
      steps: v.number(),
    })
  ),
});

export const RETIRED_PROGRAM_ZERO_RECEIPT_VERSION =
  "retired-learning-program-zero-v1";

export const retiredProgramZeroReceiptValidator = v.object({
  learningPlanItems: v.literal(0),
  learningPlans: v.literal(0),
  learningProfiles: v.literal(0),
  learningProgramCoverage: v.literal(0),
  learningProgramSources: v.literal(0),
  learningPrograms: v.literal(0),
  version: v.literal(RETIRED_PROGRAM_ZERO_RECEIPT_VERSION),
});

/** Durable evidence from one isolated authenticated reference proof. */
export const referenceProofReceiptValidator = v.object({
  count: v.number(),
  provedAt: v.number(),
});

export const readerCutoverReceiptValidator = v.object({
  acceptedAt: v.number(),
  history: historyMarkerProofValidator,
  referenceProofs: v.object({
    article: v.number(),
    material: v.number(),
    materialTopic: v.number(),
    quran: v.number(),
    tryout: v.number(),
  }),
});

/** Durable cursor for the transaction-bounded Quran reference proof. */
export const quranReferenceProgressValidator = v.object({
  afterIndex: v.number(),
  checked: v.number(),
  snapshotId: v.string(),
});

const activeMaterialTopicValidator = v.object({
  locale: appLocaleValidator,
  publicPath: v.string(),
  title: v.string(),
  topicAlignmentId: v.string(),
  topicAssetId: v.string(),
  topicConceptId: v.string(),
  topicLearningObjectId: v.string(),
  topicLensId: v.string(),
});

/** Durable cursor for bounded material topic staging and ordered proof. */
export const materialReferenceProgressValidator = v.union(
  v.object({
    afterAssetId: v.string(),
    checked: v.number(),
    phase: v.literal("stage"),
  }),
  v.object({
    activeTopic: v.optional(activeMaterialTopicValidator),
    checked: v.number(),
    cursor: v.union(v.string(), v.null()),
    phase: v.literal("prove"),
    topics: v.number(),
  })
);

const tables = {
  /** Monotonic legacy-write token used to close the preflight lock race. */
  contentCutoverActivity: defineTable({
    key: v.literal("legacy"),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_key", ["key"]),

  /**
   * Temporary, singleton Phase 1 cutover checkpoint and publication guard.
   *
   * There is intentionally no unfreeze mutation. The coordinated Phase 2
   * deployment must follow the exact `phase2.md` ledger. Removing only these
   * rows would be an unsafe rollback.
   */
  contentCutoverState: defineTable({
    articleReferenceProof: v.optional(referenceProofReceiptValidator),
    audioWorkflowAudit: v.optional(audioWorkflowAuditValidator),
    audioWorkflowAuditedAt: v.optional(v.number()),
    audioWorkflowCleanedAt: v.optional(v.number()),
    auditedActiveReleaseId: v.string(),
    auditedActiveSequence: v.number(),
    auditedAt: v.number(),
    auditedLegacyWriteVersion: v.number(),
    auditedNextSequence: v.number(),
    currentCursor: v.optional(v.string()),
    currentDeleted: v.number(),
    currentTableDeleted: v.number(),
    currentTableIndex: v.number(),
    currentTablePreserved: v.number(),
    frozenAt: v.optional(v.number()),
    inventoryVersion: v.literal("production-2026-08-13"),
    key: v.literal("phase1"),
    legacyDeleted: v.number(),
    legacyTableDeleted: v.number(),
    legacyTableIndex: v.number(),
    phase: cutoverPhaseValidator,
    provedAt: v.optional(v.number()),
    materialReferenceProof: v.optional(referenceProofReceiptValidator),
    materialReferenceProgress: v.optional(materialReferenceProgressValidator),
    materialTopicReferenceProof: v.optional(referenceProofReceiptValidator),
    quranReferenceProof: v.optional(referenceProofReceiptValidator),
    quranReferenceProgress: v.optional(quranReferenceProgressValidator),
    /** Written only by the later deployment that owns the live reader cutover. */
    readerCutoverReceipt: v.optional(readerCutoverReceiptValidator),
    retiredProgramZeroReceipt: v.optional(retiredProgramZeroReceiptValidator),
    tryoutReferenceProof: v.optional(referenceProofReceiptValidator),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
};

export default tables;
