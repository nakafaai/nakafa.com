import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { hasTerminalCutoverEvidence } from "@repo/backend/convex/contentRelease/cutover/evidence";
import { verifyRetainedTryoutInventory } from "@repo/backend/convex/contentRelease/cutover/retained";
import { loadCutoverState } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { completedReceipt } from "@repo/backend/convex/contentRelease/receipt";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { v } from "convex/values";
import { Effect } from "effect";

const checkpointRetirementReceiptValidator = v.object({
  activeManifestHash: v.string(),
  activeReleaseId: v.string(),
  activityDeleted: v.number(),
  attempts: v.number(),
  checkpointDeleted: v.number(),
  placements: v.number(),
  progress: v.number(),
});

interface ActiveIdentity {
  readonly activeManifestHash: string;
  readonly activeReleaseId: string;
}

/** Deletes the proved maintenance checkpoint after exact genesis acceptance. */
export const retireCutoverCheckpoint = Effect.fn(
  "contentRelease.cutover.retireCheckpoint"
)(function* (ctx: MutationCtx, identity: ActiveIdentity) {
  const checkpoint = yield* loadCutoverState(ctx);
  const activity = yield* Effect.promise(() =>
    ctx.db
      .query("contentCutoverActivity")
      .withIndex("by_key", (index) => index.eq("key", "legacy"))
      .unique()
  );
  if ((checkpoint === null) !== (activity === null)) {
    return yield* checkpointFailure(
      "Cutover checkpoint rows are only partially present."
    );
  }
  if (
    checkpoint &&
    (checkpoint.phase !== "proved" ||
      checkpoint.provedAt === undefined ||
      !hasTerminalCutoverEvidence(checkpoint) ||
      checkpoint.currentDeleted !== 22_954 ||
      checkpoint.legacyDeleted !== 12_854 ||
      activity?.version !== checkpoint.auditedLegacyWriteVersion)
  ) {
    return yield* checkpointFailure(
      "Cutover checkpoint does not contain the exact terminal proof."
    );
  }

  yield* verifyAcceptedGenesis(ctx, identity);
  const [attempts, placements, progress] = yield* loadRetainedInventory(ctx);
  yield* verifyRetainedTryoutInventory(attempts, placements, progress);
  if (
    attempts.some((row) => "locale" in row) ||
    placements.some((row) => "title" in row) ||
    progress.some((row) => "locale" in row)
  ) {
    return yield* checkpointFailure(
      "Retained try-out compatibility fields have not been retired."
    );
  }

  if (checkpoint && activity) {
    yield* Effect.all([
      Effect.promise(() =>
        ctx.db.delete("contentCutoverState", checkpoint._id)
      ),
      Effect.promise(() =>
        ctx.db.delete("contentCutoverActivity", activity._id)
      ),
    ]);
  }
  return {
    ...identity,
    activityDeleted: activity ? 1 : 0,
    attempts: attempts.length,
    checkpointDeleted: checkpoint ? 1 : 0,
    placements: placements.length,
    progress: progress.length,
  };
});

const verifyAcceptedGenesis = Effect.fn(
  "contentRelease.cutover.verifyAcceptedGenesis"
)(function* (ctx: MutationCtx, identity: ActiveIdentity) {
  const state = yield* loadState(ctx);
  if (
    !state ||
    state.activeReleaseId !== identity.activeReleaseId ||
    state.activeManifestHash !== identity.activeManifestHash ||
    state.activeSequence === undefined ||
    state.nextSequence <= state.activeSequence ||
    state.candidateReleaseId !== undefined ||
    state.candidateManifestHash !== undefined ||
    state.candidateSequence !== undefined ||
    state.recoveryReleaseId !== undefined ||
    state.recoveryManifestHash !== undefined ||
    state.recoverySequence !== undefined ||
    !hasActiveReadModels(state, identity, state.activeSequence)
  ) {
    return yield* checkpointFailure(
      "Current publication does not own the accepted genesis identity."
    );
  }
  const release = yield* loadRelease(ctx, identity.activeReleaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const renderer = yield* decodeRendererJson(release.rendererJson);
  if (
    release.sequence !== state.activeSequence ||
    release.role !== "candidate" ||
    signed.manifestHash !== identity.activeManifestHash ||
    signed.manifest.releaseId !== identity.activeReleaseId ||
    !hasRendererIdentity(signed.manifest, renderer) ||
    !hasGenesisManifest(signed.manifest) ||
    !sameValues(release.baseFamilies, []) ||
    !sameValues(release.resultFamilies, ContentFamilySchema.literals)
  ) {
    return yield* checkpointFailure(
      "Active release is not the exact six-scope genesis."
    );
  }
  yield* completedReceipt(release, signed);
});

function hasGenesisManifest(
  manifest: Effect.Effect.Success<
    ReturnType<typeof decodeReleaseJson>
  >["manifest"]
) {
  return (
    manifest.baseReleaseId === null &&
    manifest.baseManifestHash === null &&
    manifest.baseActiveAppLocales === null &&
    manifest.baseResultCount === 0 &&
    manifest.baseResultDigest === EMPTY_RESULT_CATALOG_DIGEST &&
    manifest.origin.kind === "git" &&
    sameValues(manifest.activeAppLocales, ACTIVE_APP_LOCALE_CODES) &&
    manifest.scope.content.length === 0 &&
    sameValues(manifest.scope.families, ContentFamilySchema.literals) &&
    sameValues(manifest.scope.snapshots, ContentSnapshotKindSchema.literals) &&
    ContentSnapshotKindSchema.literals.every((family) => {
      const snapshot = manifest.snapshots[family];
      return (
        snapshot.mode === "replace" &&
        snapshot.baseSnapshotId === null &&
        snapshot.resultSnapshotId !== null
      );
    })
  );
}

function hasActiveReadModels(
  state: NonNullable<Effect.Effect.Success<ReturnType<typeof loadState>>>,
  identity: ActiveIdentity,
  sequence: number
) {
  return (
    state.articleReleaseId === identity.activeReleaseId &&
    state.articleManifestHash === identity.activeManifestHash &&
    state.articleSequence === sequence &&
    state.materialReleaseId === identity.activeReleaseId &&
    state.materialManifestHash === identity.activeManifestHash &&
    state.materialSequence === sequence &&
    state.searchReleaseId === identity.activeReleaseId &&
    state.searchManifestHash === identity.activeManifestHash &&
    state.searchSequence === sequence
  );
}

function loadRetainedInventory(ctx: MutationCtx) {
  const plan = retainedTryoutHistoryPlan;
  return Effect.all([
    Effect.promise(() =>
      ctx.db.query("tryoutAttempts").take(plan.attemptCount + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .take(plan.frozenPlacementCount + 1)
    ),
    Effect.promise(() =>
      ctx.db.query("tryoutSetProgress").take(plan.progressCount + 1)
    ),
  ]);
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function checkpointFailure(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}

/** Executes the one exact maintenance-checkpoint retirement. */
export const retire = internalMutation({
  args: {
    activeManifestHash: v.string(),
    activeReleaseId: v.string(),
  },
  returns: checkpointRetirementReceiptValidator,
  handler: (ctx, args) => runConvexProgram(retireCutoverCheckpoint(ctx, args)),
});
