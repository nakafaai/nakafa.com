import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  AUDITED_ACTIVE_RELEASE_ID,
  AUDITED_CONTENT_RELEASE_COUNT,
  RETAINED_TRYOUT_RELEASES,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { releaseStatusValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

export interface AuditFacts {
  readonly activeReleaseCount: number;
  readonly activeReleaseId?: string;
  readonly activeReleaseSequence?: number;
  readonly activeReleaseStatus?: string;
  readonly activeSequence?: number;
  readonly bundles: readonly {
    readonly manifestHash: string;
    readonly releaseId: string;
    readonly snapshotId: string;
  }[];
  readonly contentStateCount: number;
  readonly hasCandidate: boolean;
  readonly hasCompaction: boolean;
  readonly hasNonretainedAttempt: boolean;
  readonly hasNonretainedBundle: boolean;
  readonly hasNonretainedScale: boolean;
  readonly hasProofWorkflow: boolean;
  readonly hasRecovery: boolean;
  readonly hasRunningReadModelJob: boolean;
  readonly nextSequence?: number;
  readonly readModelsCurrent: boolean;
  readonly releaseCount: number;
  readonly retainedSnapshotCount: number;
}

const auditFactsValidator = v.object({
  activeReleaseCount: v.number(),
  activeReleaseId: v.optional(v.string()),
  activeReleaseSequence: v.optional(v.number()),
  activeReleaseStatus: v.optional(releaseStatusValidator),
  activeSequence: v.optional(v.number()),
  bundles: v.array(
    v.object({
      manifestHash: v.string(),
      releaseId: v.string(),
      snapshotId: v.string(),
    })
  ),
  contentStateCount: v.number(),
  hasCandidate: v.boolean(),
  hasCompaction: v.boolean(),
  hasNonretainedAttempt: v.boolean(),
  hasNonretainedBundle: v.boolean(),
  hasNonretainedScale: v.boolean(),
  hasProofWorkflow: v.boolean(),
  hasRecovery: v.boolean(),
  hasRunningReadModelJob: v.boolean(),
  nextSequence: v.optional(v.number()),
  readModelsCurrent: v.boolean(),
  releaseCount: v.number(),
  retainedSnapshotCount: v.number(),
});

/** Reads bounded identity and background-writer facts, never content bytes. */
export const facts = internalQuery({
  args: {},
  returns: auditFactsValidator,
  handler: (ctx) => runConvexProgram(readAuditFacts(ctx)),
});

/** Proves publication quiescence facts within a query or mutation transaction. */
export const readAuditFacts = Effect.fn(
  "contentRelease.cutover.readAuditFacts"
)(function* (ctx: ReadCtx) {
  const [
    activeReleases,
    bundles,
    nonretainedAttempt,
    nonretainedBundle,
    nonretainedScale,
    releases,
    retainedSnapshots,
    states,
  ] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", AUDITED_ACTIVE_RELEASE_ID)
        )
        .take(2)
    ),
    Effect.promise(() => ctx.db.query("tryoutBundles").take(3)),
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .filter((filter) =>
          filter.neq(
            filter.field("tryoutSnapshotId"),
            RETAINED_TRYOUT_SNAPSHOT_ID
          )
        )
        .take(1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutBundles")
        .filter((filter) =>
          filter.neq(filter.field("snapshotId"), RETAINED_TRYOUT_SNAPSHOT_ID)
        )
        .take(1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("irtScaleVersions")
        .filter((filter) =>
          filter.neq(
            filter.field("tryoutSnapshotId"),
            RETAINED_TRYOUT_SNAPSHOT_ID
          )
        )
        .take(1)
    ),
    Effect.promise(() =>
      ctx.db.query("contentReleases").take(AUDITED_CONTENT_RELEASE_COUNT + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_family_and_snapshotId", (index) =>
          index
            .eq("family", "tryout")
            .eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
        )
        .take(2)
    ),
    Effect.promise(() => ctx.db.query("contentState").take(2)),
  ]);
  const jobs = yield* Effect.forEach(releases, (release) => {
    const syncJobId = release.syncJobId;
    if (!syncJobId) {
      return Effect.succeed(null);
    }
    return Effect.promise(() =>
      ctx.db.system.get("_scheduled_functions", syncJobId)
    );
  });
  const activeRelease = activeReleases.at(0);
  const state = states.at(0);
  return {
    activeReleaseCount: activeReleases.length,
    activeReleaseId: state?.activeReleaseId,
    activeReleaseSequence: activeRelease?.sequence,
    activeReleaseStatus: activeRelease?.status,
    activeSequence: state?.activeSequence,
    bundles: bundles.map(({ manifestHash, releaseId, snapshotId }) => ({
      manifestHash,
      releaseId,
      snapshotId,
    })),
    contentStateCount: states.length,
    hasCandidate: state?.candidateReleaseId !== undefined,
    hasCompaction: hasCompaction(state),
    hasNonretainedAttempt: nonretainedAttempt.length !== 0,
    hasNonretainedBundle: nonretainedBundle.length !== 0,
    hasNonretainedScale: nonretainedScale.length !== 0,
    hasProofWorkflow: releases.some(
      ({ proofWorkflowId }) => proofWorkflowId !== undefined
    ),
    hasRecovery: state?.recoveryReleaseId !== undefined,
    hasRunningReadModelJob: jobs.some(
      (job) => job?.state.kind === "pending" || job?.state.kind === "inProgress"
    ),
    nextSequence: state?.nextSequence,
    readModelsCurrent: hasCurrentReadModels(state),
    releaseCount: releases.length,
    retainedSnapshotCount: retainedSnapshots.length,
  } satisfies AuditFacts;
});

/** Requires exact publication identity with no background writer in flight. */
export const validateQuiescentPublication = Effect.fn(
  "contentRelease.cutover.validateQuiescentPublication"
)(function* (facts: AuditFacts) {
  if (
    facts.contentStateCount !== 1 ||
    facts.activeReleaseCount !== 1 ||
    facts.activeReleaseId !== AUDITED_ACTIVE_RELEASE_ID ||
    facts.activeSequence === undefined ||
    facts.activeReleaseSequence !== facts.activeSequence ||
    facts.activeReleaseStatus !== "completed" ||
    facts.releaseCount !== AUDITED_CONTENT_RELEASE_COUNT ||
    facts.nextSequence === undefined ||
    facts.hasCandidate ||
    facts.hasRecovery ||
    facts.hasCompaction ||
    facts.hasProofWorkflow ||
    facts.hasRunningReadModelJob ||
    !facts.readModelsCurrent ||
    facts.hasNonretainedAttempt ||
    facts.hasNonretainedBundle ||
    facts.hasNonretainedScale ||
    facts.retainedSnapshotCount !== 1
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Cutover inventory: publication identity or background-writer state changed."
    );
  }
  const releases = new Map<string, (typeof RETAINED_TRYOUT_RELEASES)[number]>(
    RETAINED_TRYOUT_RELEASES.map((release) => [release.releaseId, release])
  );
  if (
    facts.bundles.length !== RETAINED_TRYOUT_RELEASES.length ||
    facts.bundles.some((bundle) => {
      const release = releases.get(bundle.releaseId);
      return (
        !release ||
        bundle.manifestHash !== release.manifestHash ||
        bundle.snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID
      );
    })
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Cutover inventory: retained try-out bundles changed."
    );
  }
});

function hasCompaction(state: Doc<"contentState"> | undefined) {
  return (
    state?.compactCursor !== undefined ||
    state?.compactFloor !== undefined ||
    state?.compactFrom !== undefined ||
    state?.compactPhase !== undefined ||
    state?.compactStartedAt !== undefined
  );
}

function hasCurrentReadModels(state: Doc<"contentState"> | undefined) {
  if (!state) {
    return false;
  }
  const manifestHash = state.activeManifestHash;
  const releaseId = state.activeReleaseId;
  const sequence = state.activeSequence;
  if (
    manifestHash === undefined ||
    releaseId === undefined ||
    sequence === undefined
  ) {
    return false;
  }
  return (
    state.articleManifestHash === manifestHash &&
    state.articleReleaseId === releaseId &&
    state.articleSequence === sequence &&
    state.materialManifestHash === manifestHash &&
    state.materialOwnerManifestHash === manifestHash &&
    state.materialOwnerReleaseId === releaseId &&
    state.materialOwnerSequence === sequence &&
    state.materialReleaseId === releaseId &&
    state.materialSequence === sequence &&
    state.searchManifestHash === manifestHash &&
    state.searchReleaseId === releaseId &&
    state.searchSequence === sequence
  );
}
