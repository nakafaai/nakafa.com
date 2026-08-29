import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import type { SignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyFinalizationPlacements } from "@repo/backend/convex/contentRelease/finalize/proof";
import {
  FINALIZATION_ATTEMPT_SET_DOMAIN,
  type FinalizationAttemptSpec,
  type FinalizationContract,
  type FinalizationReceipt,
  finalizationContract,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { requireFinalizationTargetProof } from "@repo/backend/convex/contentRelease/finalize/targets";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  encodeRendererJson,
  encodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/wire";
import {
  findTryoutRuntimeBundleByHash,
  storeAuthenticatedTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

/** Checks whether one stored attempt belongs to one exact recovered class. */
function matchesAttempt(attempt: TryoutAttempt, spec: FinalizationAttemptSpec) {
  return (
    attempt.appLocale === spec.appLocale &&
    attempt.snapshotReleaseId === spec.snapshotReleaseId &&
    attempt.totalQuestions === spec.totalQuestions &&
    attempt.tryoutSnapshotId === spec.snapshotId
  );
}

/** Classifies paired permanent ownership without accepting partial state. */
const readPermanentState = Effect.fn(
  "contentRelease.finalize.readPermanentState"
)(function* (attempt: TryoutAttempt) {
  const hasId = attempt.tryoutBundleId !== undefined;
  const hasHash = attempt.tryoutBundleHash !== undefined;
  if (hasId !== hasHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion found partial runtime ownership."
    );
  }
  return hasId && hasHash;
});

/** Requires the exact signed genesis payload and its existing renderer bytes. */
const requireGenesisIdentity = Effect.fn(
  "contentRelease.finalize.requireGenesisIdentity"
)(function* (
  bundle: SignedTryoutRuntimeBundle,
  renderer: RendererManifestEnvelope,
  contract: FinalizationContract
) {
  const identity = contract.genesisIdentity;
  if (
    bundle.bundleHash !== contract.genesisBundleHash ||
    bundle.payload.rendererManifestHash !== identity.rendererManifestHash ||
    bundle.payload.snapshot.snapshotId !== identity.snapshotId ||
    bundle.payload.sourceGitSha !== identity.sourceGitSha ||
    bundle.payload.sourceManifestHash !== identity.sourceManifestHash ||
    bundle.payload.sourceReleaseId !== identity.sourceReleaseId ||
    renderer.hash !== identity.rendererManifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis runtime bytes differ from the reviewed production source."
    );
  }
});

/** Selects each recovered attempt class exactly once from a bounded inventory. */
const selectAttempts = Effect.fn("contentRelease.finalize.selectAttempts")(
  function* (
    attempts: readonly TryoutAttempt[],
    contract: FinalizationContract
  ) {
    const rows = yield* Effect.forEach(contract.attempts, (spec) => {
      const matches = attempts.filter((attempt) =>
        matchesAttempt(attempt, spec)
      );
      const attempt = matches[0];
      return matches.length === 1 && attempt
        ? Effect.succeed({ attempt, spec })
        : releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Terminal try-out expansion lost one exact attempt class."
          );
    });
    const ids = rows.map(({ attempt }) => attempt._id).sort();
    const digest = yield* hashText(
      "terminal try-out attempt set",
      `${FINALIZATION_ATTEMPT_SET_DOMAIN}\n${JSON.stringify(ids)}`
    );
    if (
      new Set(ids).size !== contract.attempts.length ||
      digest !== contract.attemptSetHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Terminal try-out expansion selected different attempt identities."
      );
    }
    return rows;
  }
);

/** Requires one proof-bound permanent target before any attempt can own it. */
const requireTargetBundle = Effect.fn(
  "contentRelease.finalize.requireTargetBundle"
)(function* (ctx: MutationCtx, spec: FinalizationAttemptSpec) {
  const stored = yield* findTryoutRuntimeBundleByHash(
    ctx,
    spec.targetBundleHash
  );
  if (!stored) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion lost its permanent target bundle."
    );
  }
  const [bundle, renderer] = yield* Effect.all([
    decodeTryoutRuntimeBundleJson(stored.bundleJson),
    decodeRendererJson(stored.rendererJson),
  ]);
  if (
    stored.bundleJson !== encodeTryoutRuntimeBundleJson(bundle) ||
    stored.rendererJson !== encodeRendererJson(renderer) ||
    stored.bundleHash !== spec.targetBundleHash ||
    stored.bundleHash !== bundle.bundleHash ||
    stored.snapshotId !== spec.snapshotId ||
    stored.snapshotId !== bundle.payload.snapshot.snapshotId ||
    stored.rendererManifestHash !== bundle.payload.rendererManifestHash ||
    stored.rendererManifestHash !== renderer.hash ||
    stored.sourceGitSha !== bundle.payload.sourceGitSha ||
    stored.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    stored.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion found a changed permanent target bundle."
    );
  }
  return stored;
});

/** Retains genesis as durable proof after its final attempt is erased. */
const retainGenesisBundle = Effect.fn(
  "contentRelease.finalize.retainGenesisBundle"
)(function* (ctx: MutationCtx, bundle: SignedTryoutRuntimeBundle) {
  const stored = yield* findTryoutRuntimeBundleByHash(ctx, bundle.bundleHash);
  if (
    !stored ||
    stored.snapshotId !== bundle.payload.snapshot.snapshotId ||
    stored.rendererManifestHash !== bundle.payload.rendererManifestHash ||
    stored.sourceGitSha !== bundle.payload.sourceGitSha ||
    stored.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    stored.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis runtime storage lost its finalization identity."
    );
  }
  if (stored.cleanupReleaseId !== undefined) {
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutRuntimeBundles", stored._id, {
        cleanupReleaseId: undefined,
      })
    );
  }
});

/** Atomically expands the exact four terminal attempts to permanent bundles. */
export const backfillRuntimeAttempts = Effect.fn(
  "contentRelease.finalize.backfillRuntimeAttempts"
)(function* (
  ctx: MutationCtx,
  bundle: SignedTryoutRuntimeBundle,
  renderer: RendererManifestEnvelope,
  targetProofHash: string,
  contract: FinalizationContract = finalizationContract
) {
  yield* requireGenesisIdentity(bundle, renderer, contract);
  yield* requireFinalizationTargetProof(ctx, targetProofHash, contract);
  const attempts = yield* Effect.promise(() =>
    ctx.db.query("tryoutAttempts").take(contract.attemptLimit + 1)
  );
  if (attempts.length > contract.attemptLimit) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion exceeded its bounded attempt inventory."
    );
  }
  const selected = yield* selectAttempts(attempts, contract);
  const selectedIds = new Set(selected.map(({ attempt }) => attempt._id));
  for (const attempt of attempts) {
    const permanent = yield* readPermanentState(attempt);
    if (!(permanent || selectedIds.has(attempt._id))) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Terminal try-out expansion found an unexpected predecessor attempt."
      );
    }
  }
  const storedGenesis = yield* storeAuthenticatedTryoutRuntimeBundle(
    ctx,
    bundle,
    renderer
  );
  if (storedGenesis.bundleHash !== contract.genesisBundleHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis runtime storage returned a different content address."
    );
  }
  yield* retainGenesisBundle(ctx, bundle);
  let backfilledAttempts = 0;
  let placementCount = 0;
  for (const { attempt, spec } of selected) {
    if (
      attempt.status === "in-progress" ||
      attempt.completedAt === null ||
      attempt.endReason === null
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "Terminal try-out expansion selected a non-terminal attempt."
      );
    }
    const target = yield* requireTargetBundle(ctx, spec);
    const placements = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .take(spec.totalQuestions + 1)
    );
    placementCount += yield* verifyFinalizationPlacements(placements, spec);
    const permanent = yield* readPermanentState(attempt);
    if (permanent) {
      if (
        attempt.tryoutBundleId !== target._id ||
        attempt.tryoutBundleHash !== target.bundleHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Terminal try-out expansion found changed permanent ownership."
        );
      }
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutAttempts", attempt._id, {
        tryoutBundleHash: target.bundleHash,
        tryoutBundleId: target._id,
      })
    );
    backfilledAttempts += 1;
  }
  return {
    backfilledAttempts,
    bundleCreated: storedGenesis.created,
    permanentAttempts: attempts.length,
    placementCount,
  } satisfies FinalizationReceipt;
});
