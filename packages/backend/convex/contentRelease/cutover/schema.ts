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
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
};

export default tables;
