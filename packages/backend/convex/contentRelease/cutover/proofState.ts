import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import {
  type AudioWorkflowAudit,
  requireAudioWorkflowCleanupCheckpoint,
} from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import {
  RETAINED_ARTIFACT_COUNT,
  RETAINED_ATTEMPT_COUNT,
  RETAINED_CATALOG_COUNT,
  RETAINED_FROZEN_PLACEMENT_COUNT,
  RETAINED_PLACEMENT_COUNT,
  RETAINED_PROGRESS_COUNT,
  RETAINED_TRYOUT_RELEASES,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { audioWorkflowAuditValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

export interface HistoryProof {
  readonly attempts: number;
  readonly catalogRows: number;
  readonly frozenPlacements: number;
  readonly markers: number;
  readonly placementRows: number;
  readonly progressRows: number;
  readonly snapshotId: string;
}

export interface RetentionFacts {
  readonly activity: null | { readonly version: number };
  readonly activityCount: number;
  readonly bundles: {
    manifestHash: string;
    releaseId: string;
    snapshotId: string;
  }[];
  readonly contentState: number;
  readonly cutover: null | {
    audioWorkflowAudit?: AudioWorkflowAudit;
    audioWorkflowAuditedAt?: number;
    audioWorkflowCleanedAt?: number;
    currentCursor?: string;
    currentDeleted: number;
    currentTableDeleted: number;
    currentTableIndex: number;
    currentTablePreserved: number;
    auditedLegacyWriteVersion: number;
    frozenAt?: number;
    inventoryVersion: string;
    legacyDeleted: number;
    legacyTableDeleted: number;
    legacyTableIndex: number;
    phase: string;
  };
  readonly cutoverCount: number;
  readonly snapshots: { family: string; snapshotId: string }[];
}

export const proofReceiptValidator = v.object({
  artifacts: v.number(),
  attempts: v.number(),
  bundles: v.number(),
  catalogRows: v.number(),
  complete: v.literal(true),
  frozenPlacements: v.number(),
  markers: v.number(),
  placementRows: v.number(),
  progressRows: v.number(),
  snapshotId: v.string(),
  snapshots: v.number(),
});

export type CutoverProofReceipt = Infer<typeof proofReceiptValidator>;

/** Returns identity-only retained facts after the mutable store is empty. */
export const retentionFacts = internalQuery({
  args: {},
  returns: v.object({
    activity: v.union(v.null(), v.object({ version: v.number() })),
    activityCount: v.number(),
    bundles: v.array(
      v.object({
        manifestHash: v.string(),
        releaseId: v.string(),
        snapshotId: v.string(),
      })
    ),
    contentState: v.number(),
    cutover: v.union(
      v.null(),
      v.object({
        audioWorkflowAudit: v.optional(audioWorkflowAuditValidator),
        audioWorkflowAuditedAt: v.optional(v.number()),
        audioWorkflowCleanedAt: v.optional(v.number()),
        currentCursor: v.optional(v.string()),
        currentDeleted: v.number(),
        currentTableDeleted: v.number(),
        currentTableIndex: v.number(),
        currentTablePreserved: v.number(),
        auditedLegacyWriteVersion: v.number(),
        frozenAt: v.optional(v.number()),
        inventoryVersion: v.string(),
        legacyDeleted: v.number(),
        legacyTableDeleted: v.number(),
        legacyTableIndex: v.number(),
        phase: v.string(),
      })
    ),
    cutoverCount: v.number(),
    snapshots: v.array(
      v.object({ family: v.string(), snapshotId: v.string() })
    ),
  }),
  handler: (ctx) => runConvexProgram(readRetentionFacts(ctx)),
});

/** Persists the terminal proven phase only for the exact accepted receipt. */
export const record = internalMutation({
  args: proofReceiptValidator,
  returns: v.null(),
  handler: (ctx, receipt) =>
    runConvexProgram(recordProofCompletion(ctx, receipt).pipe(Effect.as(null))),
});

/** Reads only exact retention identities, never immutable content bytes. */
const readRetentionFacts = Effect.fn(
  "contentRelease.cutover.readRetentionFacts"
)(function* (ctx: QueryCtx) {
  const [activityRows, bundles, contentState, cutoverRows, snapshots] =
    yield* Effect.all([
      Effect.promise(() => ctx.db.query("contentCutoverActivity").take(2)),
      Effect.promise(() => ctx.db.query("tryoutBundles").take(3)),
      Effect.promise(() => ctx.db.query("contentState").take(1)),
      Effect.promise(() => ctx.db.query("contentCutoverState").take(2)),
      Effect.promise(() => ctx.db.query("contentSnapshots").take(2)),
    ]);
  const activity = activityRows.at(0);
  const cutover = cutoverRows.at(0);
  return {
    activity: activity ? { version: activity.version } : null,
    activityCount: activityRows.length,
    bundles: bundles.map(({ manifestHash, releaseId, snapshotId }) => ({
      manifestHash,
      releaseId,
      snapshotId,
    })),
    contentState: contentState.length,
    cutover: cutover
      ? {
          audioWorkflowAudit: cutover.audioWorkflowAudit,
          audioWorkflowAuditedAt: cutover.audioWorkflowAuditedAt,
          audioWorkflowCleanedAt: cutover.audioWorkflowCleanedAt,
          currentCursor: cutover.currentCursor,
          currentDeleted: cutover.currentDeleted,
          currentTableDeleted: cutover.currentTableDeleted,
          currentTableIndex: cutover.currentTableIndex,
          currentTablePreserved: cutover.currentTablePreserved,
          auditedLegacyWriteVersion: cutover.auditedLegacyWriteVersion,
          frozenAt: cutover.frozenAt,
          inventoryVersion: cutover.inventoryVersion,
          legacyDeleted: cutover.legacyDeleted,
          legacyTableDeleted: cutover.legacyTableDeleted,
          legacyTableIndex: cutover.legacyTableIndex,
          phase: cutover.phase,
        }
      : null,
    cutoverCount: cutoverRows.length,
    snapshots: snapshots.map(({ family, snapshotId }) => ({
      family,
      snapshotId,
    })),
  } satisfies RetentionFacts;
});

/** Commits proof completion after validating every receipt identity and count. */
export const recordProofCompletion = Effect.fn(
  "contentRelease.cutover.recordProofCompletion"
)(function* (ctx: MutationCtx, receipt: CutoverProofReceipt) {
  const cutover = yield* requireCutoverPhase(ctx, ["complete", "proved"]);
  yield* requireAudioWorkflowCleanupCheckpoint({
    audit: cutover.audioWorkflowAudit,
    auditedAt: cutover.audioWorkflowAuditedAt,
    cleanedAt: cutover.audioWorkflowCleanedAt,
  });
  if (
    receipt.artifacts !== RETAINED_ARTIFACT_COUNT ||
    receipt.attempts !== RETAINED_ATTEMPT_COUNT ||
    receipt.bundles !== RETAINED_TRYOUT_RELEASES.length ||
    receipt.catalogRows !== RETAINED_CATALOG_COUNT ||
    receipt.frozenPlacements !== RETAINED_FROZEN_PLACEMENT_COUNT ||
    receipt.markers !== RETAINED_ATTEMPT_COUNT ||
    receipt.placementRows !== RETAINED_PLACEMENT_COUNT ||
    receipt.progressRows !== RETAINED_PROGRESS_COUNT ||
    receipt.snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID ||
    receipt.snapshots !== 1
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Cutover proof receipt differs from the accepted production inventory."
    );
  }
  if (cutover.phase === "proved") {
    return;
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", cutover._id, {
      phase: "proved",
      provedAt: now,
      updatedAt: now,
    })
  );
});
